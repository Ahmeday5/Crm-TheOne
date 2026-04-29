import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./report-and-analytics.component').then(
        (m) => m.ReportAndAnalyticsComponent,
      ),
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      {
        path: 'panel',
        title: 'لوحة التقارير',
        loadComponent: () =>
          import('./pages/reports-panel/reports-panel.component').then(
            (m) => m.ReportsPanelComponent,
          ),
      },
      {
        path: 'emp-report',
        title: 'تقارير الموظفين',
        loadComponent: () =>
          import('./pages/employee-reports/employee-reports.component').then(
            (m) => m.EmployeeReportsComponent,
          ),
      },
      {
        path: 'marketing-report',
        title: 'تقارير التسويق',
        loadComponent: () =>
          import('./pages/marketing-reports/marketing-reports.component').then(
            (m) => m.MarketingReportsComponent,
          ),
      },
      {
        path: 'sales-report',
        title: 'تقارير المبيعات',
        loadComponent: () =>
          import('./pages/sales-reports/sales-reports.component').then(
            (m) => m.SalesReportsComponent,
          ),
      },
      {
        path: 'app-report',
        title: 'تقارير الدعم الفني',
        loadComponent: () =>
          import('./pages/app-support-reports/app-support-reports.component').then(
            (m) => m.AppSupportReportsComponent,
          ),
      },
      {
        path: 'projects-report',
        title: 'تقارير المشاريع',
        loadComponent: () =>
          import('./pages/projects-reports/projects-reports.component').then(
            (m) => m.ProjectsReportsComponent,
          ),
      },
      {
        path: 'custom-report',
        title: 'تقارير مخصصة',
        loadComponent: () =>
          import('./pages/custom-reports/custom-reports.component').then(
            (m) => m.CustomReportsComponent,
          ),
      },
    ],
  },
];
