import { Injectable, computed, inject, signal } from '@angular/core';
import { resolveAssetUrl } from '../../../core/utils/asset-url.util';
import { CLIENT_PORTAL_GATEWAY } from '../data/client-portal.gateway';
import { PortalBranding } from '../models/client-portal.models';

const FALLBACK_LOGO = '/assets/img/logo.png';
const FALLBACK_NAME = 'TheOne';

/**
 * The company identity the portal wears (logo, name, contact) — from the
 * anonymous `ClientPortal/branding`, loaded once, with TheOne fallbacks so the
 * portal never renders unbranded (even on the link-error pages).
 */
@Injectable({ providedIn: 'root' })
export class PortalBrandingService {
  private readonly gateway = inject(CLIENT_PORTAL_GATEWAY);
  private readonly data = signal<PortalBranding | null>(null);
  private requested = false;

  readonly branding = this.data.asReadonly();
  readonly name = computed(() => this.data()?.companyName?.trim() || FALLBACK_NAME);
  readonly tagline = computed(() => this.data()?.tagline?.trim() || '');
  readonly logo = computed(() => resolveAssetUrl(this.data()?.logoUrl) || FALLBACK_LOGO);
  readonly logoDark = computed(() => resolveAssetUrl(this.data()?.logoDarkUrl) || this.logo());
  readonly mark = computed(() => resolveAssetUrl(this.data()?.logoMarkUrl) || this.logo());
  readonly fallbackLogo = FALLBACK_LOGO;

  readonly whatsAppHref = computed(() => waHref(this.data()?.supportWhatsApp));
  readonly phoneHref = computed(() => telHref(this.data()?.supportPhone));
  readonly emailHref = computed(() => (this.data()?.supportEmail ? `mailto:${this.data()!.supportEmail}` : null));
  readonly websiteHref = computed(() => {
    const w = this.data()?.website?.trim();
    if (!w) return null;
    return /^https?:\/\//i.test(w) ? w : `https://${w}`;
  });
  readonly hasContact = computed(() => !!(this.whatsAppHref() || this.phoneHref() || this.emailHref()));

  load(): void {
    if (this.requested) return;
    this.requested = true;
    this.gateway.branding().subscribe({
      next: (b) => this.data.set(b),
      error: () => (this.requested = false),
    });
  }
}

/** `https://wa.me/<digits>` with an optional prefilled message. */
export function waHref(phone: string | null | undefined, text?: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telHref(phone: string | null | undefined): string | null {
  const clean = (phone ?? '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : null;
}
