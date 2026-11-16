import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import { VaultSessionService } from '../state/vault-session.service';

/**
 * Vault data calls (`/Vault`, `/Vault/{id}…`, `/Vault/lock/audit`) — NOT the
 * lock endpoints that come before a token exists (`lock-status`, `unlock`,
 * `lock/setup`, `lock/change-password`).
 */
const VAULT_DATA_URL = /\/Vault(\/(?!lock-status|unlock|lock\/setup|lock\/change-password)[^?]*)?(\?|$)/i;

/** Every reason the server gives for "the vault isn't open for you". */
const LOCK_REASONS = new Set(['vault_not_configured', 'vault_locked', 'vault_token_invalid', 'vault_token_expired']);

/**
 * Adds `X-Vault-Token` to vault data requests while unlocked, and when the
 * server answers 403 with a vault reason (expired / revoked / never set up),
 * drops the token so the page falls back to the lock screen.
 */
export const vaultTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!VAULT_DATA_URL.test(req.url)) return next(req);
  const session = inject(VaultSessionService);
  const token = session.token();
  const out = token ? req.clone({ setHeaders: { 'X-Vault-Token': token } }) : req;
  return next(out).pipe(
    catchError((err: unknown) => {
      // `errorInterceptor` sits closer to the server, so this is usually an
      // `ApiError` already (`reason` filled from body / header).
      const e = err as Partial<ApiError> & Partial<HttpErrorResponse>;
      const reason = e.reason || e.error?.data?.reason || e.headers?.get?.('X-Vault-Error');
      if (e.status === 403 && reason && LOCK_REASONS.has(reason)) session.lock(reason);
      return throwError(() => err);
    }),
  );
};
