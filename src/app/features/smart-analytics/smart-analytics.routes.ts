import { Routes } from '@angular/router';

/**
 * Smart analytics — Admin, Marketing and Sales open the page; the monthly
 * performance review section inside it is Admin-only (hidden from the tabs
 * and refused by the repository / backend for everyone else).
 *
 * Deep links: `/smart-analytics?tab=sources|timing|health|performance`.
 */
export const SMART_ANALYTICS_ROUTES: Routes = [
  {
    path: 'smart-analytics',
    title: 'التحليلات الذكية',
    data: { roles: ['Admin', 'Marketing', 'Sales'] },
    loadComponent: () =>
      import('./pages/smart-analytics/smart-analytics.component').then(
        (m) => m.SmartAnalyticsComponent,
      ),
  },
];
