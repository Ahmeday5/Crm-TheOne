import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    title: 'اللوحة الرئيسية',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'marketing-dashboard',
    title: 'التسويق',
    loadComponent: () =>
      import('./pages/marketing-dashboard/marketing-dashboard.component').then(
        (m) => m.MarketingDashboardComponent,
      ),
  },
  {
    path: 'sales-dashboard',
    title: 'المبيعات',
    loadComponent: () =>
      import('./pages/sales-dashboard/sales-dashboard.component').then(
        (m) => m.SalesDashboardComponent,
      ),
  },
  {
    path: 'appsupport-dashboard',
    title: 'الدعم الفني',
    loadComponent: () =>
      import('./pages/appsupport-dashboard/appsupport-dashboard.component').then(
        (m) => m.AppsupportDashboardComponent,
      ),
  },
  {
    path: 'developer-dashboard',
    title: 'المطورين',
    loadComponent: () =>
      import('./pages/developer-dashboard/developer-dashboard.component').then(
        (m) => m.DeveloperDashboardComponent,
      ),
  },
  {
    path: 'developer-analytics',
    title: 'تحليلات فريق التطوير',
    data: { roles: ['Admin', 'Developer'] },
    loadComponent: () =>
      import('./pages/developer-analytics/developer-analytics.component').then(
        (m) => m.DeveloperAnalyticsComponent,
      ),
  },
];
