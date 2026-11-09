import { Routes } from '@angular/router';

/**
 * Sales playbook — Admin / Sales / Support can browse; create, edit,
 * delete and "load ready content" are gated to Admin inside the page and in
 * the repository (the backend enforces it too).
 */
export const SALES_PLAYBOOK_ROUTES: Routes = [
  {
    path: 'sales-playbook',
    title: 'دليل المبيعات',
    data: { roles: ['Admin', 'Marketing', 'Sales'] },
    loadComponent: () =>
      import('./pages/sales-playbook/sales-playbook.component').then((m) => m.SalesPlaybookComponent),
  },
];
