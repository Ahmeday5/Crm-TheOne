import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { QrCodeComponent } from '../../../../shared/components/qr-code/qr-code.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import { ClientRelease, DownloadLink } from '../../models/client-portal.models';
import { formatBytes, platformIcon, stageClass } from '../../utils/client-portal-ui.util';

/**
 * "حمّل التطبيق" — the newest version per platform as a hero card (one big
 * Download button, a QR to install straight on the phone, release notes,
 * install help), then the older versions.
 *
 * Downloads go through a short-lived signed link (`download-link`) so the
 * phone needs no session.
 */
@Component({
  selector: 'app-portal-releases',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, QrCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-releases.component.html',
  styleUrl: './portal-releases.component.scss',
})
export class PortalReleasesComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);

  readonly projectId = input.required<number>();
  readonly items = input.required<ClientRelease[]>();

  protected readonly latest = computed(() => this.items().filter((r) => r.isLatest));
  protected readonly older = computed(() => this.items().filter((r) => !r.isLatest));
  protected readonly showOlder = signal(false);

  protected readonly busyId = signal<number | null>(null);
  protected readonly errorId = signal<number | null>(null);
  /** Release whose QR is open + its signed link. */
  protected readonly qr = signal<{ id: number; link: DownloadLink } | null>(null);
  protected readonly qrBusy = signal<number | null>(null);

  protected readonly icon = platformIcon;
  protected readonly stageClass = stageClass;
  protected readonly size = formatBytes;

  protected notes(r: ClientRelease): string[] {
    return (r.releaseNotes ?? '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }

  protected download(r: ClientRelease): void {
    if (r.externalUrl && !r.hasFile) {
      window.open(r.externalUrl, '_blank', 'noopener');
      return;
    }
    this.busyId.set(r.id);
    this.errorId.set(null);
    this.api.downloadLink(this.projectId(), r.id).subscribe({
      next: (link) => {
        this.busyId.set(null);
        const a = document.createElement('a');
        a.href = link.url;
        a.download = r.fileName ?? '';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      error: () => {
        this.busyId.set(null);
        this.errorId.set(r.id);
      },
    });
  }

  protected toggleQr(r: ClientRelease): void {
    if (this.qr()?.id === r.id) {
      this.qr.set(null);
      return;
    }
    if (r.externalUrl && !r.hasFile) {
      this.qr.set({ id: r.id, link: { url: r.externalUrl, expiresAt: '' } });
      return;
    }
    this.qrBusy.set(r.id);
    this.errorId.set(null);
    this.api.downloadLink(this.projectId(), r.id).subscribe({
      next: (link) => {
        this.qrBusy.set(null);
        this.qr.set({ id: r.id, link });
      },
      error: () => {
        this.qrBusy.set(null);
        this.errorId.set(r.id);
      },
    });
  }
}
