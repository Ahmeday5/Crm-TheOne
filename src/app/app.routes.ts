import { Routes } from '@angular/router';

import { AUTH_ROUTES } from './features/auth/auth.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { LEADS_ROUTES } from './features/leads/leads.routes';
import { SALES_PHASES_ROUTES } from './features/salesPhases/salesPhases.routes';
import { APP_SUPPORT_ROUTES } from './features/appSupport/appSupport.routes';
import { PROJECTS_TASKS_ROUTES } from './features/ProjectsTasks/projectsTasks.routes';
import { REPORT_ROUTES } from './features/report-and-analytics/reportsAnalytics.routes';

/**
 * Top-level route table.
 *  - Each feature owns a `*.routes.ts` next to its module.
 *  - Route configs are imported statically (cheap), but every page component
 *    inside them uses `loadComponent` so the heavy work is still lazy.
 */
export const routes: Routes = [
  // Public area (login, future password-reset, …)
  ...AUTH_ROUTES,

  // Authenticated app shell — everything below renders inside MainLayout.
  {
    path: '',
    loadComponent: () =>
      import('./core/layouts/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    children: [
      ...DASHBOARD_ROUTES,
      ...LEADS_ROUTES,
      ...SALES_PHASES_ROUTES,
      ...APP_SUPPORT_ROUTES,
      ...PROJECTS_TASKS_ROUTES,
      {
        path: 'ReportAndAnalytics',
        children: REPORT_ROUTES,
      },
    ],
  },

  { path: '**', redirectTo: '/auth/login' },
];
