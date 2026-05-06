import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { LEADS_ROUTES } from './features/leads/leads.routes';
import { SALES_PHASES_ROUTES } from './features/salesPhases/salesPhases.routes';
import { APP_SUPPORT_ROUTES } from './features/appSupport/appSupport.routes';
import { PROJECTS_TASKS_ROUTES } from './features/ProjectsTasks/projectsTasks.routes';
import { REPORT_ROUTES } from './features/report-and-analytics/reportsAnalytics.routes';
import { SETTINGS_ROUTES } from './features/settings/settings.routes';
import { MARKETING_CAMPAIGNS_ROUTES } from './features/marketing-campaigns/marketingCampaigns.routes';
import { SERVICES_ROUTES } from './features/services/services.routes';

/**
 * Top-level route table.
 *  - Each feature owns a `*.routes.ts` next to its module.
 *  - Route configs are imported statically (cheap), but every page component
 *    inside them uses `loadComponent` so the heavy work is still lazy.
 *  - Wildcard handling is split: anonymous traffic goes to `/auth/login`
 *    (via the shell's `authGuard`), authenticated traffic falls into the
 *    in-shell 404 page so the sidebar / topbar stay available.
 */
export const routes: Routes = [
  // Public area (login, future password-reset, …)
  // The auth routes themselves run `loggedInRedirectGuard` so a signed-in
  // user typing `/auth/login` is bounced back to their role's home.
  ...AUTH_ROUTES,

  // Authenticated app shell — everything below renders inside MainLayout.
  // `authGuard` blocks anonymous traffic at the door; `roleGuard` then runs
  // per-leaf to enforce role-based access using each route's `data.roles`
  // (or, when missing, the static `ROUTE_ROLE_MAP`).
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
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
      ...MARKETING_CAMPAIGNS_ROUTES,
      ...SERVICES_ROUTES,
      {
        path: 'ReportAndAnalytics',
        data: { roles: ['Admin'] },
        children: REPORT_ROUTES,
      },
      {
        path: 'settings',
        data: { roles: ['Admin'] },
        children: SETTINGS_ROUTES,
      },
      {
        path: '404',
        title: '404',
        loadComponent: () =>
          import('./features/not-found/not-found.component').then(
            (m) => m.NotFoundComponent,
          ),
      },
      // In-shell wildcard: everything authenticated-but-unmatched lands on /404.
      { path: '**', redirectTo: '404' },
    ],
  },

  // Last-resort wildcard (only fires if the shell load fails).
  { path: '**', redirectTo: '/auth/login' },
];
