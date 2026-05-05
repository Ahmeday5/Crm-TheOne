import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * Inverse of `authGuard`: reject access for users that are already logged in.
 * Used on `/auth/*` routes — typing `/auth/login` while authenticated bounces
 * you back to your role's home instead of forcing a re-login.
 */
export const loggedInRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return true;

  router.navigateByUrl(homeForRole(auth.currentRole()));
  return false;
};

function homeForRole(role: UserRole | null): string {
  switch (role) {
    case 'Admin':     return '/';
    case 'Marketing': return '/marketing-dashboard';
    case 'Sales':     return '/sales-dashboard';
    case 'Support':   return '/appsupport-dashboard';
    case 'Developer': return '/developer-dashboard';
    default:          return '/';
  }
}
