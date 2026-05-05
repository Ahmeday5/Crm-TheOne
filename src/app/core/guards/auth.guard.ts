import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Bounces unauthenticated users to the login page, preserving the intended
 * destination as a `returnUrl` query param so we can come back after login.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  router.navigate(['/auth/login'], {
    queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : {},
  });
  return false;
};
