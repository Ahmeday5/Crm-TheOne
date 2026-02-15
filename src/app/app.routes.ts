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
    component: MainLayoutComponent,
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
            loadComponent: () =>
              import('./features/salesPhases/pages/sales-line/sales-line.component').then(
                (m) => m.SalesLineComponent,
              ),
            title: 'خط المبيعات',
          },
          {
            path: 'line',
            loadComponent: () =>
              import('./features/leads/pages/sales-leads/sales-leads.component').then(
                (m) => m.SalesLeadsComponent,
              ),
            title: 'إدارة العملاء المحتملين',
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
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];
