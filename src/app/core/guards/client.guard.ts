import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROLE_HOME } from '../constants/role-home.const';
import { AuthService } from '../services/auth.service';

/**
 * `/portal/**` — Client role only. Staff who land here go to their own home;
 * anyone signed out goes to the login page (keeping the target URL).
 */
export const clientGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }
  const role = auth.currentRole();
  if (role === 'Client') return true;
  return router.createUrlTree([role ? ROLE_HOME[role] : '/auth/login']);
};
