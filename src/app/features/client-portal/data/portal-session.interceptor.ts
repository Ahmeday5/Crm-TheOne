import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { SKIP_AUTH } from '../../../core/http/http-context.tokens';
import { ApiError } from '../../../core/models/api-response.model';
import { PORTAL_LINK_PROBLEMS, PortalLinkProblem } from '../models/portal-session.models';
import { PortalSessionService, toLinkError } from '../services/portal-session.service';

const PORTAL_PREFIX = 'ClientPortal/';
const ANONYMOUS = [API_ENDPOINTS.clientPortal.session, API_ENDPOINTS.clientPortal.branding];

/**
 * `ClientPortal/*` calls carry the portal JWT, never the staff token (runs
 * before `authInterceptor` and flags `SKIP_AUTH`).
 *
 * - Expired / about-to-expire JWT → one shared silent re-exchange of the link.
 * - 401 with a link reason (`link_revoked`, `link_expired`, …) → the session
 *   ends and the client lands on the matching explanation page.
 * - Any other 401 → re-exchange once and retry.
 */
export const portalSessionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes(PORTAL_PREFIX)) return next(req);
  req.context.set(SKIP_AUTH, true);
  if (ANONYMOUS.some((p) => req.url.endsWith(p))) return next(req);

  const session = inject(PortalSessionService);
  const send = (token: string) => next(withBearer(req, token));
  const token = session.freshAccessToken();

  const first$ = token ? send(token) : session.refresh().pipe(switchMap((s) => send(s.accessToken)));

  return first$.pipe(
    catchError((err: ApiError) => {
      if (err?.status !== 401) return throwError(() => err);
      const reason = err.reason as PortalLinkProblem | undefined;
      if (reason && (PORTAL_LINK_PROBLEMS as ReadonlyArray<string>).includes(reason)) {
        session.fail(reason);
        return throwError(() => err);
      }
      return session.refresh().pipe(
        switchMap((s) => send(s.accessToken)),
        catchError((e) => {
          const problem = toLinkError(e);
          if (problem.problem !== 'network') session.fail(problem.problem, problem.retryAfterSec);
          return throwError(() => e);
        }),
      );
    }),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
