import { Routes } from '@angular/router';
import { PLAYBOOK_READER_ROLES } from './sales-playbook.permissions';

/**
 * Sales playbook — every role can browse (the shell's `roleGuard` reads
 * `data.roles`). Finer rights (content = Admin, competitor mentions =
 * Admin / Sales / Support) live in `sales-playbook.permissions.ts`.
 */
export const SALES_PLAYBOOK_ROUTES: Routes = [
  {
    path: 'sales-playbook',
    title: 'دليل المبيعات',
    data: { roles: PLAYBOOK_READER_ROLES },
    loadComponent: () =>
      import('./pages/sales-playbook/sales-playbook.component').then((m) => m.SalesPlaybookComponent),
  },
];
