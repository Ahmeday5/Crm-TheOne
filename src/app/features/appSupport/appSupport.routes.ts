import { Routes } from '@angular/router';

export const APP_SUPPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/app-support-main/app-support-main.component').then(
        (m) => m.AppSupportMainComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboardSupport', pathMatch: 'full' },
      {
        path: 'dashboardSupport',
        title: 'لوحة التحكم',
        loadComponent: () =>
          import('./pages/dashboard-app-support/dashboard-app-support.component').then(
            (m) => m.DashboardAppSupportComponent,
          ),
      },
      {
        path: 'Designated-clients',
        title: 'العملاء المعينون',
        loadComponent: () =>
          import('./pages/designated-clients/designated-clients.component').then(
            (m) => m.DesignatedClientsComponent,
          ),
      },
      {
        path: 'SupportTickets',
        title: 'تذاكر الدعم',
        loadComponent: () =>
          import('./pages/support-tickets/support-tickets.component').then(
            (m) => m.SupportTicketsComponent,
          ),
      },
      {
        path: 'SupportLog',
        title: 'سجل الدعم',
        loadComponent: () =>
          import('./pages/technical-support-log/technical-support-log.component').then(
            (m) => m.TechnicalSupportLogComponent,
          ),
      },
    ],
  },
  {
    path: 'technical-consultation',
    title: 'الاستشارة الفنية',
    loadComponent: () =>
      import(
        './pages/designated-clients/technical-consultation/technical-consultation.component'
      ).then((m) => m.TechnicalConsultationComponent),
  },
  {
    path: 'details-of-support-cases',
    title: 'تفاصيل حالات الدعم المفتوحة',
    loadComponent: () =>
      import(
        './pages/support-tickets/details-of-support-cases/details-of-support-cases.component'
      ).then((m) => m.DetailsOfSupportCasesComponent),
  },
];
