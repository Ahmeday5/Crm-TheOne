import { Routes } from '@angular/router';

/**
 * Services is a master-data page driven by the Admin role. We expose it as a
 * top-level route under `/services` so deep links stay short, and gate it
 * with `data.roles` so the role guard refuses non-admins even if they type
 * the URL by hand. The matching entry sits under "System administration"
 * in the sidebar.
 */
export const SERVICES_ROUTES: Routes = [
  {
    path: 'services',
    title: 'إدارة الخدمات',
    data: { roles: ['Admin', 'Marketing'] },
    loadComponent: () =>
      import('./pages/services-list/services-list.component').then(
        (m) => m.ServicesListComponent,
      ),
  },
];
