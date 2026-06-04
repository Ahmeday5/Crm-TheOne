import { Routes } from '@angular/router';

/**
 * WhatsApp Sessions feature routes (Admin-only).
 *
 *   /whatsapp-sessions       → sessions list + create
 *   /whatsapp-sessions/:id   → session details, QR / pairing, status, health
 */
export const WHATSAPP_ROUTES: Routes = [
  {
    path: 'whatsapp-sessions',
    title: 'جلسات واتساب',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/sessions/sessions.component').then(
        (m) => m.SessionsComponent,
      ),
  },
  {
    path: 'whatsapp-sessions/:id',
    title: 'تفاصيل الجلسة',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/session-details/session-details.component').then(
        (m) => m.SessionDetailsComponent,
      ),
  },
  {
    path: 'whatsapp-sessions/:id/chat',
    title: 'المحادثة',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/session-chat/session-chat.component').then(
        (m) => m.SessionChatComponent,
      ),
  },
];
