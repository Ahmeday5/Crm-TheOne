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
import { DAILY_REPORTS_ROUTES } from './features/daily-reports/dailyReports.routes';


export const routes: Routes = [
  ...AUTH_ROUTES,
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
      ...DAILY_REPORTS_ROUTES,
      {
        path: 'sales-analysis',
        title: 'تحليل نتائج المبيعات',
        data: { roles: ['Admin', 'Marketing'] },
        loadComponent: () =>
          import(
            './features/report-and-analytics/pages/sales-reports/sales-reports.component'
          ).then((m) => m.SalesReportsComponent),
      },
      {
        path: 'resources',
        title: 'إدارة الموارد',
        data: { roles: ['Admin'] },
        loadComponent: () =>
          import(
            './features/resource-management/pages/resource-management/resource-management.component'
          ).then((m) => m.ResourceManagementComponent),
      },
      {
        path: 'knowledge-base',
        title: 'قاعدة المعرفة',
        data: { roles: ['Admin', 'Support', 'Developer'] },
        loadComponent: () =>
          import(
            './features/knowledge-base/pages/knowledge-base/knowledge-base.component'
          ).then((m) => m.KnowledgeBaseComponent),
      },
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
