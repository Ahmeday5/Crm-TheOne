import { Routes } from '@angular/router';

/**
 * WhatsApp Sessions feature routes (open to every authenticated user).
 *
 *   /whatsapp-sessions       → sessions list + create
 *   /whatsapp-sessions/:id   → session details, QR / pairing, status, health
 */
export const WHATSAPP_ROUTES: Routes = [
  {
    path: 'whatsapp-sessions',
    title: 'جلسات واتساب',
    loadComponent: () =>
      import('./pages/sessions/sessions.component').then(
        (m) => m.SessionsComponent,
      ),
  },
  {
    path: 'whatsapp-sessions/:id',
    title: 'تفاصيل الجلسة',
    loadComponent: () =>
      import('./pages/session-details/session-details.component').then(
        (m) => m.SessionDetailsComponent,
      ),
  },
  {
    path: 'whatsapp-sessions/:id/chat',
    title: 'المحادثة',
    loadComponent: () =>
      import('./pages/session-chat/session-chat.component').then(
        (m) => m.SessionChatComponent,
      ),
  },
];
