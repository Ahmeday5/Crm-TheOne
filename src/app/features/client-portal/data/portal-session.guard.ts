import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalSessionService } from '../services/portal-session.service';

/**
 * `/portal/**` — needs a session opened from the client's private link.
 * Without one there is nothing to sign in to: explain how to get the link.
 */
export const portalSessionGuard: CanActivateFn = () => {
  const session = inject(PortalSessionService);
  if (session.isOpen()) return true;
  return inject(Router).createUrlTree(['/portal/access'], { queryParams: { reason: 'no_link' } });
};
