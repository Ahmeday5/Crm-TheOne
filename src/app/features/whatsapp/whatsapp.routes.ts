import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { WHATSAPP_ROLES } from './utils/whatsapp.util';

/**
 * Matches `/whatsapp` and `/whatsapp/:chatId` with ONE route, so switching
 * chats re-uses the inbox (list, scroll, polling) instead of re-creating it.
 */
export function whatsappInboxMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'whatsapp') return null;
  if (segments.length === 1) return { consumed: segments };
  if (segments.length === 2 && /^\d+$/.test(segments[1].path)) {
    return { consumed: segments, posParams: { chatId: segments[1] } };
  }
  return null;
}

/**
 * WhatsApp inbox (Admin / Sales / Support). The admin's number ↔ employee
 * screen lives under Settings (`settings.routes.ts`).
 */
export const WHATSAPP_ROUTES: Routes = [
  {
    matcher: whatsappInboxMatcher,
    title: 'واتساب',
    data: { roles: [...WHATSAPP_ROLES] },
    loadComponent: () =>
      import('./pages/whatsapp-inbox/whatsapp-inbox.component').then((m) => m.WhatsAppInboxComponent),
  },
];
