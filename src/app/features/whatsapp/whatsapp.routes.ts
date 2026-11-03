import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { WHATSAPP_ROLES } from './utils/whatsapp.util';

/**
 * Matches `/whatsapp` and `/whatsapp/chats/:chatId` with ONE route, so
 * opening another chat re-uses the inbox (lists, scroll, hub subscriptions)
 * instead of re-creating it.
 */
export function whatsappInboxMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'whatsapp') return null;
  if (segments.length === 1) return { consumed: segments };
  if (segments.length === 3 && segments[1].path === 'chats' && /^\d+$/.test(segments[2].path)) {
    return { consumed: segments, posParams: { chatId: segments[2] } };
  }
  return null;
}

/**
 * WhatsApp (Admin / Sales / Support):
 *   /whatsapp                 inbox
 *   /whatsapp/chats/:chatId   inbox with that chat open (notification deep links)
 *   /whatsapp/numbers         Admin — numbers & assignment
 */
export const WHATSAPP_ROUTES: Routes = [
  {
    path: 'whatsapp/numbers',
    title: 'أرقام واتساب',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/whatsapp-numbers/whatsapp-numbers.component').then((m) => m.WhatsAppNumbersComponent),
  },
  {
    matcher: whatsappInboxMatcher,
    title: 'واتساب',
    data: { roles: [...WHATSAPP_ROLES] },
    loadComponent: () =>
      import('./pages/whatsapp-inbox/whatsapp-inbox.component').then((m) => m.WhatsAppInboxComponent),
  },
  // Links from before chats moved under `/chats`.
  { path: 'whatsapp/:chatId', redirectTo: 'whatsapp/chats/:chatId' },
];
