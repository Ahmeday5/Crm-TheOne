import { Routes } from '@angular/router';

export const REPORT_ROUTES: Routes = [
  {
    path: 'ReportAndAnalytics',
    loadComponent: () =>
      import('./report-and-analytics.component').then(
        (m) => m.ReportAndAnalyticsComponent,
      ),
    children: [
      {
        path: '',
        redirectTo: 'panel',
        pathMatch: 'full',
      },

      {
        path: 'panel',
        loadComponent: () =>
          import('./pages/reports-panel/reports-panel.component').then(
            (m) => m.ReportsPanelComponent,
          ),
      },
      {
        path: 'emp-report',
        loadComponent: () =>
          import('./pages/employee-reports/employee-reports.component').then(
            (m) => m.EmployeeReportsComponent,
          ),
      },
      {
        path: 'marketing-report',
        loadComponent: () =>
          import('./pages/marketing-reports/marketing-reports.component').then(
            (m) => m.MarketingReportsComponent,
          ),
      },
      {
        path: 'sales-report',
        loadComponent: () =>
          import('./pages/sales-reports/sales-reports.component').then(
            (m) => m.SalesReportsComponent,
          ),
      },
      {
        path: 'app-report',
        loadComponent: () =>
          import('./pages/app-support-reports/app-support-reports.component').then(
            (m) => m.AppSupportReportsComponent,
          ),
      },
      {
        path: 'projects-report',
        loadComponent: () =>
          import('./pages/projects-reports/projects-reports.component').then(
            (m) => m.ProjectsReportsComponent,
          ),
      },
      {
        path: 'custom-report',
        loadComponent: () =>
          import('./pages/custom-reports/custom-reports.component').then(
            (m) => m.CustomReportsComponent,
          ),
      },
    ],
  },
];
