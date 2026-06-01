import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { CACHE_TTL } from '../constants/cache-policy.const';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
} from '../http/http-context.tokens';
import { CompanySettings } from '../../shared/models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CompanySettingsService {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly titleService = inject(Title);

  private readonly assetOrigin = environment.apiUrl.replace(/\/api\/?$/i, '');

  private readonly _settings = signal<CompanySettings | null>(null);
  /** Raw settings (null until first load). */
  readonly settings = this._settings.asReadonly();

  readonly companyName = computed(() => this._settings()?.companyName?.trim() || '');
  readonly tradeName = computed(
    () => this._settings()?.tradeName?.trim() || this.companyName(),
  );

  readonly currency = computed(() => this._settings()?.defaultCurrency?.trim() || '');

  readonly logoUrl = computed(() => this.assetUrl(this._settings()?.logoUrl));
  readonly faviconUrl = computed(() => this.assetUrl(this._settings()?.faviconUrl));

  // ── contact ──
  readonly email = computed(() => this._settings()?.email?.trim() || '');
  readonly phone = computed(() => this._settings()?.phone?.trim() || '');
  readonly mobile = computed(() => this._settings()?.mobile?.trim() || '');
  readonly address = computed(() => this._settings()?.address?.trim() || '');
  readonly website = computed(() => this._settings()?.website?.trim() || '');

  // ── legal ──
  readonly commercialRegistration = computed(
    () => this._settings()?.commercialRegistration?.trim() || '',
  );
  readonly taxNumber = computed(() => this._settings()?.taxNumber?.trim() || '');

  readonly websiteHref = computed(() => {
    const w = this.website();
    if (!w) return null;
    return /^https?:\/\//i.test(w) ? w : `https://${w}`;
  });
  readonly mailtoHref = computed(() =>
    this.email() ? `mailto:${this.email()}` : null,
  );
  readonly phoneHref = computed(() => this.telHref(this.phone()));
  readonly mobileHref = computed(() => this.telHref(this.mobile()));
  /** WhatsApp deep link built from the mobile number's digits. */
  readonly whatsappHref = computed(() => {
    const digits = this.mobile().replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

  private loaded = false;

  ensureLoaded(): void {
    if (this.loaded || this._settings()) return;
    this.load().subscribe({ error: () => {} });
  }

  load(): Observable<CompanySettings> {
    return this.api
      .get<CompanySettings>(API_ENDPOINTS.companySettings.get, {
        context: withCache({ ttlMs: CACHE_TTL.LONG }),
      })
      .pipe(tap((s) => this.apply(s)));
  }

  update(form: FormData): Observable<CompanySettings> {
    return this.api
      .put<CompanySettings>(API_ENDPOINTS.companySettings.update, form, {
        context: withInlineHandling(withCacheInvalidate(['CompanySettings'])),
      })
      .pipe(tap((s) => this.apply(s)));
  }

  /** Resolve a server-relative image path to an absolute URL. */
  assetUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.assetOrigin}/${path.replace(/^\//, '')}`;
  }

  // ─────────── internals ───────────

  private telHref(value: string): string | null {
    const cleaned = value.replace(/[^\d+]/g, '');
    return cleaned ? `tel:${cleaned}` : null;
  }

  private apply(settings: CompanySettings): void {
    this.loaded = true;
    this._settings.set(settings);
    this.applyFavicon(this.assetUrl(settings.faviconUrl));
    this.applyTitle(settings.companyName);
  }

  private applyFavicon(href: string | null): void {
    if (!href) return;
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      head.appendChild(link);
    }
    link.href = href;
  }

  private applyTitle(name: string | null): void {
    if (name?.trim()) this.titleService.setTitle(name.trim());
  }
}
