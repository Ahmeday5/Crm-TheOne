import { Routes } from '@angular/router';

/**
 * Notification-center routes.
 *
 * Open to every authenticated user — notifications are per-user. The admin-only
 * "send notification" action is gated inside the page by role, not by the route.
 */
export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: 'notifications',
    title: 'مركز الإشعارات',
    loadComponent: () =>
      import('./pages/notifications-center/notifications-center.component').then(
        (m) => m.NotificationsCenterComponent,
      ),
  },
];
