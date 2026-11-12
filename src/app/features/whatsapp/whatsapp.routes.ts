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
 * WhatsApp + Messenger (Admin / Sales / Support) — every page lazy-loaded:
 *   /whatsapp                 inbox
 *   /whatsapp/chats/:chatId   inbox with that chat open (notification deep links)
 *   /whatsapp/settings        Admin — channels, import, diagnostics
 * Roles are enforced by the shell's role guard from `data.roles`.
 */
export const WHATSAPP_ROUTES: Routes = [
  {
    path: 'whatsapp/settings',
    title: 'إعدادات واتساب',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/whatsapp-settings/whatsapp-settings.component').then((m) => m.WhatsAppSettingsComponent),
  },
  // The page was called "numbers" before Messenger pages joined the channels.
  { path: 'whatsapp/numbers', redirectTo: 'whatsapp/settings' },
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
