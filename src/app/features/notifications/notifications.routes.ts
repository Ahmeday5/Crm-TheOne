import { Routes } from '@angular/router';

/**
 * Notification-center routes — Admin only.
 *
 * The center (full history + manual "send notification") is an admin tool and
 * lives next to the announcements board in the sidebar. Every other role still
 * receives notifications through the header bell and the live toasts.
 */
export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: 'notifications',
    title: 'مركز الإشعارات',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/notifications-center/notifications-center.component').then(
        (m) => m.NotificationsCenterComponent,
      ),
  },
];
