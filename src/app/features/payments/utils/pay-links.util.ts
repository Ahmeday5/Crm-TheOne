import { PaymentMethodSnapshot, PaymentMethodType } from '../models/payments.models';
import { PaymentProvider, providerOf } from './payment-providers.const';

export type DevicePlatform = 'android' | 'ios' | 'desktop';

export function detectPlatform(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): DevicePlatform {
  if (/android/i.test(ua)) return 'android';
  // iPadOS 13+ reports itself as Mac — touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function playStoreUrl(pkg: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
}

export function appStoreSearchUrl(term: string): string {
  return `https://apps.apple.com/eg/search?term=${encodeURIComponent(term)}`;
}

/**
 * Link that opens the provider's app:
 *  - Android: an `intent:` URL launching the app's main screen; Chrome falls
 *    back to the Play Store page when it isn't installed.
 *  - iOS: these apps publish no public URL scheme, so we land on the App
 *    Store (it shows "Open" when the app is installed).
 *  - Desktop: the Play Store page (the payer is told to use their phone).
 */
export function openAppUrl(provider: PaymentProvider, platform: DevicePlatform): string {
  const store = playStoreUrl(provider.androidPackage);
  if (platform === 'android') {
    return (
      'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;' +
      `package=${provider.androidPackage};S.browser_fallback_url=${encodeURIComponent(store)};end`
    );
  }
  if (platform === 'ios') return appStoreSearchUrl(provider.iosSearch);
  return store;
}

/**
 * InstaPay: the account's own payment link (`ipn.eg`) is a universal link —
 * it opens InstaPay on the recipient's profile directly. Without it, open the app.
 */
export function instapayUrl(method: PaymentMethodSnapshot, platform: DevicePlatform): string {
  const link = method.instapayLink?.trim();
  return link && /^https:\/\//i.test(link) ? link : openAppUrl(providerOf('InstaPay'), platform);
}

/** Egyptian mobile in local form (`01xxxxxxxxx`) — what USSD menus expect. */
export function localMobile(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
}

/** Whole pounds only — USSD menus reject decimals. */
function ussdAmount(amount: number): string {
  return String(Math.ceil(Math.max(0, amount)));
}

export interface UssdCode {
  /** What the payer sees / copies, e.g. `*9*7*01012345678*500#`. */
  code: string;
  /** `tel:` link (`#` → `%23`). Android dials it; iOS refuses `*`/`#` links, so it's copy-only there. */
  telUrl: string;
  /** `true` = the code does the whole transfer; `false` = it opens the menu (show the steps). */
  direct: boolean;
}

/**
 * USSD code the payer dials from THEIR wallet (`payerType`) to send `amount`
 * to `recipientPhone` (cross-wallet transfers work between all four wallets).
 */
export function ussdFor(payerType: PaymentMethodType, recipientPhone: string | null, amount: number): UssdCode | null {
  const provider = providerOf(payerType);
  const phone = localMobile(recipientPhone);
  const direct = provider.ussdDirect && phone ? provider.ussdDirect.replace('{phone}', phone).replace('{amount}', ussdAmount(amount)) : null;
  const code = direct ?? provider.ussdMenu;
  if (!code) return null;
  return { code, telUrl: `tel:${code.replace(/#/g, '%23')}`, direct: !!direct };
}

/** The public link for a request token, on the current site. */
export function publicPayUrl(token: string, origin: string = typeof location === 'undefined' ? '' : location.origin): string {
  return `${origin}/pay/${encodeURIComponent(token)}`;
}
