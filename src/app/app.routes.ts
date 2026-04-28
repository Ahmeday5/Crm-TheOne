import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { marketingGuard } from './core/guards/marketing.guard';
import { AuthLayoutComponent } from './core/layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './core/layouts/main-layout/main-layout.component';

export const routes: Routes = [
  // 🔹 Routes قبل اللوجين
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login/login.component').then(
            (m) => m.LoginComponent,
          ),
        title: 'تسجيل الدخول',
      },
    ],
  },

  // 🔹 Routes بعد اللوجين
  {
    path: '',
    loadComponent: () =>
      import('./core/layouts/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        title: 'اللوحة الرئيسية',
      },
      {
        path: 'marketing-dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/marketing-dashboard/marketing-dashboard.component').then(
            (m) => m.MarketingDashboardComponent,
          ),
        title: 'التسويق',
      },
      {
        path: 'sales-dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/sales-dashboard/sales-dashboard.component').then(
            (m) => m.SalesDashboardComponent,
          ),
        title: 'المبيعات',
      },
      {
        path: 'appsupport-dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/appsupport-dashboard/appsupport-dashboard.component').then(
            (m) => m.AppsupportDashboardComponent,
          ),
        title: 'الدعم الفني',
      },
      {
        path: 'developer-dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/developer-dashboard/developer-dashboard.component').then(
            (m) => m.DeveloperDashboardComponent,
          ),
        title: 'المطورين',
      },
      // Leads Routes
      {
        path: 'leads',
        canActivate: [authGuard], // الـ Guard يوجه حسب Role
        children: [
          {
            path: 'marketing-leadsCustomer',
            loadComponent: () =>
              import('./features/leads/pages/marketing-leads/marketing-leads.component').then(
                (m) => m.MarketingLeadsComponent,
              ),
            title: 'إدارة العملاء المحتملين',
          },
          {
            path: 'sales-leadsCustomer',
            loadComponent: () =>
              import('./features/leads/pages/sales-leads/sales-leads.component').then(
                (m) => m.SalesLeadsComponent,
              ),
            title: 'إدارة العملاء المحتملين',
          },
          {
            path: 'add-leadCustomer',
            loadComponent: () =>
              import('./features/leads/pages/add-lead/add-lead.component').then(
                (m) => m.AddLeadComponent,
              ),
            canActivate: [marketingGuard],
            title: 'إضافة عميل محتمل',
          },
        ],
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/salesPhases/pages/sales-phase/sales-phase.component').then(
            (m) => m.SalesPhaseComponent,
          ),
        children: [
          { path: '', redirectTo: 'line', pathMatch: 'full' },
          {
            path: 'line',
            title: 'خط المبيعات',
            loadComponent: () =>
              import('./features/salesPhases/pages/sales-line/sales-line.component').then(
                (m) => m.SalesLineComponent,
              ),
          },
          {
            path: 'price-offers',
            loadComponent: () =>
              import('./features/salesPhases/pages/price-offers/price-offers.component').then(
                (m) => m.PriceOffersComponent,
              ),
            title: 'عروض الاسعار',
          },
          {
            path: 'contracts',
            loadComponent: () =>
              import('./features/salesPhases/pages/contracts/contracts.component').then(
                (m) => m.ContractsComponent,
              ),
            title: 'العقود',
          },
          {
            path: 'follow-ups',
            loadComponent: () =>
              import('./features/salesPhases/pages/follow-ups/follow-ups.component').then(
                (m) => m.FollowUpsComponent,
              ),
            title: 'المتابعات',
          },
        ],
      },
      {
        path: 'view-details-deal',
        title: 'تفاصيل الصفقة',
        loadComponent: () =>
          import('./features/salesPhases/pages/sales-line/view-details/view-details.component').then(
            (m) => m.ViewDetailsComponent,
          ),
      },
      {
        path: 'add-price-offer',
        title: 'إضافة عرض السعر',
        loadComponent: () =>
          import('./features/salesPhases/pages/price-offers/add-price-offer/add-price-offer.component').then(
            (m) => m.AddPriceOfferComponent,
          ),
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/appSupport/pages/app-support-main/app-support-main.component').then(
            (m) => m.AppSupportMainComponent,
          ),
        children: [
          { path: '', redirectTo: 'dashboardSupport', pathMatch: 'full' },
          {
            path: 'dashboardSupport',
            title: 'لوحة التحكم',
            loadComponent: () =>
              import('./features/appSupport/pages/dashboard-app-support/dashboard-app-support.component').then(
                (m) => m.DashboardAppSupportComponent,
              ),
          },
          {
            path: 'Designated-clients',
            loadComponent: () =>
              import('./features/appSupport/pages/designated-clients/designated-clients.component').then(
                (m) => m.DesignatedClientsComponent,
              ),
            title: 'العملاء المعينون',
          },
          {
            path: 'SupportTickets',
            loadComponent: () =>
              import('./features/appSupport/pages/support-tickets/support-tickets.component').then(
                (m) => m.SupportTicketsComponent,
              ),
            title: 'تذاكر الدعم',
          },
          {
            path: 'SupportLog',
            loadComponent: () =>
              import('./features/appSupport/pages/technical-support-log/technical-support-log.component').then(
                (m) => m.TechnicalSupportLogComponent,
              ),
            title: 'سجل الدعم',
          },
        ],
      },
      {
        path: 'technical-consultation',
        loadComponent: () =>
          import('./features/appSupport/pages/designated-clients/technical-consultation/technical-consultation.component').then(
            (m) => m.TechnicalConsultationComponent,
          ),
        title: 'الاستشارة الفنية',
      },
      {
        path: 'details-of-support-cases',
        loadComponent: () =>
          import('./features/appSupport/pages/support-tickets/details-of-support-cases/details-of-support-cases.component').then(
            (m) => m.DetailsOfSupportCasesComponent,
          ),
        title: 'تفاصيل حالات الدعم المفتوحة',
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/ProjectsTasks/pages/projects-and-tasks/projects-and-tasks.component').then(
            (m) => m.ProjectsAndTasksComponent,
          ),
        children: [
          { path: '', redirectTo: 'ProjectManage', pathMatch: 'full' },
          {
            path: 'ProjectManage',
            title: 'إدارة المشاريع',
            loadComponent: () =>
              import('./features/ProjectsTasks/pages/project-manage/project-manage.component').then(
                (m) => m.ProjectManageComponent,
              ),
          },
          {
            path: 'TasksManage',
            loadComponent: () =>
              import('./features/ProjectsTasks/pages/tasks-manage/tasks-manage.component').then(
                (m) => m.TasksManageComponent,
              ),
            title: 'إدارة المهام',
          },
        ],
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/report-and-analytics/reportsAnalytics.routes').then(
            (m) => m.REPORT_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];
