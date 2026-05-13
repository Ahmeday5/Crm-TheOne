import { Routes } from '@angular/router';

/**
 * Daily reports feature routes.
 *
 * Visible to every authenticated role — the page itself flips between the
 * `/myreports` and `/Reports` endpoints based on `AuthService.currentRole()`,
 * so non-admins only ever see their own data.
 */
export const DAILY_REPORTS_ROUTES: Routes = [
  {
    path: 'daily-reports',
    title: 'التقارير اليومية',
    loadComponent: () =>
      import('./pages/daily-reports/daily-reports.component').then(
        (m) => m.DailyReportsComponent,
      ),
  },
];
