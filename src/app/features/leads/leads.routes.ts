import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { marketingGuard } from '../../core/guards/marketing.guard';

export const LEADS_ROUTES: Routes = [
  {
    path: 'leads',
    canActivate: [authGuard],
    children: [
      {
        path: 'marketing-leadsCustomer',
        title: 'إدارة العملاء المحتملين',
        loadComponent: () =>
          import('./pages/marketing-leads/marketing-leads.component').then(
            (m) => m.MarketingLeadsComponent,
          ),
      },
      {
        path: 'sales-leadsCustomer',
        title: 'إدارة العملاء المحتملين',
        loadComponent: () =>
          import('./pages/sales-leads/sales-leads.component').then(
            (m) => m.SalesLeadsComponent,
          ),
      },
      {
        path: 'add-leadCustomer',
        title: 'إضافة عميل محتمل',
        canActivate: [marketingGuard],
        loadComponent: () =>
          import('./pages/add-lead/add-lead.component').then((m) => m.AddLeadComponent),
      },
    ],
  },
];
