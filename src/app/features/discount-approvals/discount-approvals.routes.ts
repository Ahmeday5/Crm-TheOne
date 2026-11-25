import { Routes } from '@angular/router';

/**
 * `/discount-approvals` (+ `/:id` from the rep's WhatsApp link or the
 * `DiscountApprovalRequested` notification) — Admin only. The page follows
 * `paramMap` itself, so it does not opt into `recreateOnParamChange`.
 */
export const DISCOUNT_APPROVALS_ROUTES: Routes = [
  {
    path: 'discount-approvals',
    title: 'موافقات الخصم',
    data: { roles: ['Admin', 'Sales', 'Marketing', 'Support'] },
    loadComponent: () =>
      import('./pages/discount-approvals/discount-approvals.component').then((m) => m.DiscountApprovalsComponent),
  },
  {
    path: 'discount-approvals/:id',
    title: 'موافقات الخصم',
    data: { roles: ['Admin', 'Sales', 'Marketing', 'Support'] },
    loadComponent: () =>
      import('./pages/discount-approvals/discount-approvals.component').then((m) => m.DiscountApprovalsComponent),
  },
];
