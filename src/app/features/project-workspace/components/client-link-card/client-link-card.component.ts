import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom, map } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { copyToClipboard } from '../../../../shared/components/copy-button/copy-button.component';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { QrCodeComponent } from '../../../../shared/components/qr-code/qr-code.component';
import { PagedResult } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { waHref } from '../../../client-portal/services/portal-branding.service';
import { CLIENT_LINK_GATEWAY } from '../../data/client-link.gateway';
import {
  ClientPortalLink,
  LINK_PIN_PATTERN,
  LinkAccessLogEntry,
  LinkScope,
  ProjectClientLink,
  linkState,
} from '../../models/client-link.models';

interface Settings {
  scope: LinkScope;
  /** `yyyy-MM-dd` or '' (never). */
  expiresOn: string;
  /** New PIN, '' = keep / none. */
  pin: string;
  removePin: boolean;
}

const LOG_PAGE = 15;

type BusyKind = 'create' | 'copy' | 'open' | 'qr' | 'wa' | 'regen' | 'revoke' | 'save';

/**
 * "رابط العميل" — the customer's private portal link: create it, copy / open /
 * QR / send on WhatsApp, see when it was last used, set an expiry or a PIN,
 * regenerate (old link dies) or revoke. Replaces the old username/password
 * client account.
 */
@Component({
  selector: 'app-client-link-card',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, TranslatePipe, CairoDatePipe, TimeAgoPipe, ModalComponent, QrCodeComponent, MockRibbonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-link-card.component.html',
  styleUrl: './client-link-card.component.scss',
})
export class ClientLinkCardComponent {
  private readonly api = inject(CLIENT_LINK_GATEWAY);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly projectId = input.required<number>();
  readonly projectName = input<string>('');
  /** Emits after create / revoke so the page can refresh its "has link" flag. */
  readonly changed = output<void>();

  protected readonly data = signal<ProjectClientLink | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal<BusyKind | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  /** Full URL once known (create / regenerate / reveal) — never persisted. */
  protected readonly fullUrl = signal<string | null>(null);
  protected readonly qrOpen = signal(false);
  protected readonly settingsOpen = signal(false);
  protected readonly settings = signal<Settings>({ scope: 'AllProjects', expiresOn: '', pin: '', removePin: false });

  protected readonly logOpen = signal(false);
  protected readonly log = signal<PagedResult<LinkAccessLogEntry> | null>(null);
  protected readonly logLoading = signal(false);

  protected readonly link = computed(() => this.data()?.link ?? null);
  protected readonly state = computed(() => {
    const l = this.link();
    return l ? linkState(l) : null;
  });
  protected readonly minDate = new Date().toISOString().slice(0, 10);
  protected readonly pinOk = computed(() => !this.settings().pin || LINK_PIN_PATTERN.test(this.settings().pin));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.forProject(this.projectId()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        this.resetSettings();
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  // ─────────── create / regenerate / revoke ───────────

  protected create(): void {
    const s = this.settings();
    if (!this.pinOk()) return;
    this.run('create', () =>
      this.api.createForProject(this.projectId(), {
        scope: s.scope,
        projectIds: s.scope === 'SelectedProjects' ? [this.projectId()] : [],
        expiresAt: s.expiresOn ? `${s.expiresOn}T23:59:59Z` : null,
        pin: s.pin || null,
      }),
    ).then((link) => link && this.applyNew(link));
  }

  protected async regenerate(): Promise<void> {
    const l = this.link();
    if (!l) return;
    const ok = await this.dialog.confirm({
      title: this.t('clientLink.regenTitle'),
      message: this.t('clientLink.regenMessage'),
      confirmText: this.t('clientLink.regenerate'),
      type: 'warning',
    });
    if (!ok) return;
    const link = await this.run('regen', () => this.api.regenerate(l.id));
    if (link) this.applyNew(link);
  }

  protected async revoke(): Promise<void> {
    const l = this.link();
    if (!l) return;
    const ok = await this.dialog.confirm({
      title: this.t('clientLink.revokeTitle'),
      message: this.t('clientLink.revokeMessage'),
      confirmText: this.t('clientLink.revoke'),
      type: 'danger',
    });
    if (!ok) return;
    const done = await this.run('revoke', () => this.api.revoke(l.id).pipe(map(() => true)));
    if (done) {
      this.fullUrl.set(null);
      this.qrOpen.set(false);
      this.changed.emit();
      this.load();
    }
  }

  // ─────────── share ───────────

  protected async copy(): Promise<void> {
    const url = await this.resolveUrl('copy');
    if (!url) return;
    if (await copyToClipboard(url)) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    }
  }

  protected async open(): Promise<void> {
    const url = await this.resolveUrl('open');
    if (url) window.open(url, '_blank', 'noopener');
  }

  protected async toggleQr(): Promise<void> {
    if (this.qrOpen()) {
      this.qrOpen.set(false);
      return;
    }
    if (await this.resolveUrl('qr')) this.qrOpen.set(true);
  }

  protected async sendWhatsApp(): Promise<void> {
    const url = await this.resolveUrl('wa');
    if (!url) return;
    const customer = this.data()?.customer;
    const text = interpolate(this.t('clientLink.waMessage'), {
      name: customer?.name ?? '',
      project: this.projectName(),
      url,
    });
    const href = waHref(customer?.phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(href, '_blank', 'noopener');
  }

  // ─────────── settings ───────────

  protected onPinInput(value: string): void {
    this.patchSettings({ pin: (value ?? '').replace(/\D/g, '').slice(0, 6) });
  }

  protected patchSettings(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  protected async saveSettings(): Promise<void> {
    const l = this.link();
    const s = this.settings();
    if (!l || !this.pinOk()) return;
    const updated = await this.run('save', () =>
      this.api.update(l.id, {
        scope: s.scope,
        projectIds: s.scope === 'SelectedProjects' ? [this.projectId()] : [],
        ...(s.expiresOn ? { expiresAt: `${s.expiresOn}T23:59:59Z` } : { clearExpiry: true }),
        ...(s.removePin ? { pin: '' } : s.pin ? { pin: s.pin } : {}),
      }),
    );
    if (updated) {
      this.data.update((d) => (d && d.link ? { ...d, link: { ...d.link, ...updated, includesThisProject: d.link.includesThisProject } } : d));
      this.settingsOpen.set(false);
      this.resetSettings();
    }
  }

  // ─────────── access log ───────────

  protected openLog(): void {
    this.logOpen.set(true);
    this.loadLog(1);
  }

  protected loadLog(pageIndex: number): void {
    const l = this.link();
    if (!l) return;
    this.logLoading.set(true);
    this.api.accessLog(l.id, pageIndex, LOG_PAGE).subscribe({
      next: (p) => {
        this.logLoading.set(false);
        this.log.update((prev) => (prev && pageIndex > 1 ? { ...p, data: [...prev.data, ...p.data] } : p));
      },
      error: () => this.logLoading.set(false),
    });
  }

  protected eventIcon(e: LinkAccessLogEntry['event']): string {
    switch (e) {
      case 'SessionStarted': return 'fa-solid fa-right-to-bracket';
      case 'SessionRefused': return 'fa-solid fa-ban';
      case 'ApkDownloaded': return 'fa-solid fa-download';
      case 'CredentialRevealed': return 'fa-solid fa-key';
      case 'RequestCreated': return 'fa-solid fa-message';
      case 'CommentAdded': return 'fa-regular fa-comment';
    }
  }

  // ─────────── internals ───────────

  private applyNew(link: ClientPortalLink): void {
    this.fullUrl.set(link.url);
    this.data.update((d) => (d ? { ...d, hasLink: true, link: { ...link, includesThisProject: true } } : d));
    this.resetSettings();
    this.changed.emit();
  }

  private async resolveUrl(action: 'copy' | 'open' | 'qr' | 'wa'): Promise<string | null> {
    if (this.fullUrl()) return this.fullUrl();
    const l = this.link();
    if (!l) return null;
    const res = await this.run(action, () => this.api.reveal(l.id));
    if (res?.url) this.fullUrl.set(res.url);
    return res?.url ?? null;
  }

  private async run<T>(kind: BusyKind, call: () => Observable<T>): Promise<T | null> {
    this.busy.set(kind);
    this.error.set(null);
    try {
      return await firstValueFrom(call());
    } catch (e) {
      this.error.set((e as ApiError)?.message ?? this.t('clientLink.failed'));
      return null;
    } finally {
      this.busy.set(null);
    }
  }

  private resetSettings(): void {
    const l = this.link();
    this.settings.set({
      scope: l?.scope ?? 'AllProjects',
      expiresOn: l?.expiresAt ? l.expiresAt.slice(0, 10) : '',
      pin: '',
      removePin: false,
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
