import { Routes } from '@angular/router';

/**
 * `/vault` — Admin role AND the vault password: the gate shows the lock screen
 * until the vault is unlocked, then the accounts list.
 */
export const VAULT_ROUTES: Routes = [
  {
    path: 'vault',
    title: 'خزنة الحسابات',
    data: { roles: ['Admin'] },
    loadComponent: () => import('./pages/vault-gate/vault-gate.component').then((m) => m.VaultGateComponent),
  },
];
