import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { UserRole } from '../models/auth.model';
import { ROUTE_ROLE_MAP } from '../constants/nav-sections.const';

/**
 * Generic role guard:
 *
 *   1. If the user is not logged in, redirect to /auth/login.
 *   2. If `route.data['roles']` is provided, accept only those roles.
 *   3. Otherwise look up the URL's first segment in `ROUTE_ROLE_MAP`.
 *   4. If neither restricts the route, allow it.
 *
 * On a role mismatch we redirect to the user's home (the dashboard for
 * their role) and toast a clear "no access" message — no silent failures.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.isLoggedIn()) {
    router.navigate(['/auth/login'], {
      queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : {},
    });
    return false;
  }

  const role = auth.currentRole();
  if (!role) {
    router.navigate(['/auth/login']);
    return false;
  }

  const allowed = (route.data?.['roles'] as UserRole[] | undefined) ?? rolesFromUrl(state.url);
  if (!allowed?.length) return true;

  if (allowed.includes(role)) return true;

  toast.warning('ليس لديك صلاحية للوصول إلى هذه الصفحة');
  router.navigateByUrl(homeForRole(role));
  return false;
};

/**
 * Pulls the first non-empty path segment and looks it up in the static map.
 * `/leads/marketing-leadsCustomer` → first segment is `leads` (not in map),
 * so deep routes fall through to "any authenticated user". This is fine —
 * `leads/*` routes already attach their own `data.roles` if needed.
 */
function rolesFromUrl(url: string): UserRole[] | undefined {
  if (!url) return undefined;
  const path = url.split('?')[0];
  const seg = path.replace(/^\//, '').split('/')[0] ?? '';
  return ROUTE_ROLE_MAP[seg];
}

/** Where each role lands when redirected away from a forbidden route. */
function homeForRole(role: UserRole): string {
  switch (role) {
    case 'Admin':     return '/';
    case 'Marketing': return '/marketing-dashboard';
    case 'Sales':     return '/sales-dashboard';
    case 'Support':   return '/appsupport-dashboard';
    case 'Developer': return '/developer-dashboard';
  }
}
