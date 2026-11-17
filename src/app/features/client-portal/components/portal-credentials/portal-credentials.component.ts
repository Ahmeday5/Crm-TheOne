import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import { ClientCredential } from '../../models/client-portal.models';
import { credentialIcon, environmentClass, urlHost } from '../../utils/client-portal-ui.util';

/** A revealed password hides itself again after this long. */
const REVEAL_MS = 30_000;

/**
 * "جرّب النظام" — the systems the client can open: link, username, and the
 * password fetched only on demand (reveal / copy are audited server-side) and
 * re-masked after 30 s.
 */
@Component({
  selector: 'app-portal-credentials',
  standalone: true,
  imports: [TranslatePipe, CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-credentials.component.html',
  styleUrl: './portal-credentials.component.scss',
})
export class PortalCredentialsComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);

  readonly projectId = input.required<number>();
  readonly items = input.required<ClientCredential[]>();

  protected readonly revealed = signal<Record<number, string>>({});
  protected readonly revealing = signal<number | null>(null);
  protected readonly failedId = signal<number | null>(null);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  protected readonly icon = credentialIcon;
  protected readonly envClass = environmentClass;
  protected readonly host = urlHost;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((t) => clearTimeout(t)));
  }

  protected toggle(c: ClientCredential): void {
    if (this.revealed()[c.id]) {
      this.hide(c.id);
      return;
    }
    this.revealing.set(c.id);
    this.failedId.set(null);
    this.fetch(c.id)
      .then((pw) => this.show(c.id, pw))
      .catch(() => this.failedId.set(c.id))
      .finally(() => this.revealing.set(null));
  }

  /** For the copy button: reuse a revealed password, else fetch it now. */
  protected passwordSource(c: ClientCredential): () => Promise<string | null> {
    return async () => this.revealed()[c.id] ?? (await this.fetch(c.id).catch(() => null));
  }

  private fetch(id: number): Promise<string> {
    return firstValueFrom(this.api.revealCredential(this.projectId(), id)).then((r) => r.password);
  }

  private show(id: number, password: string): void {
    this.revealed.update((m) => ({ ...m, [id]: password }));
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.hide(id), REVEAL_MS));
  }

  private hide(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.revealed.update((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }
}
