import { Routes } from '@angular/router';

/**
 * Internal chat feature route.
 *
 * Available to every authenticated role — the sidebar entry has no `roles`
 * restriction, so the page is reachable by anyone signed in.
 */
export const INTERNAL_CHAT_ROUTES: Routes = [
  {
    path: 'internal-chat',
    title: 'الدردشة الداخلية',
    loadComponent: () =>
      import('./pages/internal-chat/internal-chat.component').then(
        (m) => m.InternalChatComponent,
      ),
  },
];
