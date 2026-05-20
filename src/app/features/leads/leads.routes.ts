import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const LEADS_ROUTES: Routes = [
  {
    path: 'leads',
    canActivate: [roleGuard],
    children: [
      {
        path: 'marketing-leadsCustomer',
        title: 'إدارة العملاء المحتملين',
        canActivate: [roleGuard],
        data: { roles: ['Admin', 'Marketing'] },
        loadComponent: () =>
          import('./pages/marketing-leads/marketing-leads.component').then(
            (m) => m.MarketingLeadsComponent,
          ),
      },
      {
        // Sales view of customers — visible to Admin too (the backend
        // returns every customer for admins and only the caller's assigned
        // customers for Sales reps).
        path: 'sales-leadsCustomer',
        title: 'عملاء المبيعات',
        canActivate: [roleGuard],
        data: { roles: ['Admin', 'Sales'] },
        loadComponent: () =>
          import('./pages/sales-leads/sales-leads.component').then(
            (m) => m.SalesLeadsComponent,
          ),
      },
      {
        path: 'add-leadCustomer',
        title: 'إضافة عميل محتمل',
        canActivate: [roleGuard],
        data: { roles: ['Admin', 'Marketing', 'Sales'] },
        loadComponent: () =>
          import('./pages/add-lead/add-lead.component').then((m) => m.AddLeadComponent),
      },
    ],
  },
];
