import { Routes } from '@angular/router';

export const VAULT_ROUTES: Routes = [
  {
    path: 'vault',
    title: 'خزنة الحسابات',
    data: { roles: ['Admin'] },
    loadComponent: () => import('./pages/vault-list/vault-list.component').then((m) => m.VaultListComponent),
  },
];
