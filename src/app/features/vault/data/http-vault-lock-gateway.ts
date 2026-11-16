import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiError } from '../../../core/models/api-response.model';
import { ApiService } from '../../../core/services/api.service';
import { VaultLockError, VaultLockStatus, VaultUnlockResult } from '../models/vault-lock.models';
import { VaultLockGateway } from './vault-lock-gateway';

/**
 * `Vault/lock-status | lock/setup | unlock | lock/change-password`.
 * Maps the HTTP outcome to a `VaultLockError`:
 *   401 → wrong password (never a logout — see `authInterceptor`)
 *   429 → locked out for `Retry-After` seconds
 *   409 → already configured (setup) / not configured (unlock)
 *   400 → weak / invalid password (server message kept)
 */
@Injectable()
export class HttpVaultLockGateway extends VaultLockGateway {
  private readonly api = inject(ApiService);

  status(): Observable<VaultLockStatus> {
    return this.api.get<VaultLockStatus>(API_ENDPOINTS.vault.lockStatus, { context: withInlineHandling() });
  }

  setup(password: string): Observable<void> {
    return this.api
      .post<unknown>(API_ENDPOINTS.vault.lockSetup, { password }, { context: withInlineHandling() })
      .pipe(map(() => undefined), catchError((e) => throwError(() => toLockError(e, 'setup'))));
  }

  unlock(password: string): Observable<VaultUnlockResult> {
    return this.api
      .post<VaultUnlockResult>(API_ENDPOINTS.vault.unlock, { password }, { context: withInlineHandling() })
      .pipe(catchError((e) => throwError(() => toLockError(e, 'unlock'))));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api
      .post<unknown>(
        API_ENDPOINTS.vault.lockChangePassword,
        { currentPassword, newPassword },
        { context: withInlineHandling(withSkipLoader()) },
      )
      .pipe(map(() => undefined), catchError((e) => throwError(() => toLockError(e, 'change'))));
  }
}

function toLockError(err: unknown, op: 'setup' | 'unlock' | 'change'): VaultLockError {
  const e = err as ApiError | null;
  switch (e?.status) {
    case 401:
      return new VaultLockError('wrong', null, null, e.message);
    case 429:
      return new VaultLockError('lockedOut', 0, e.retryAfterSec ?? 60, e.message);
    case 409:
      return new VaultLockError(op === 'setup' ? 'alreadyConfigured' : 'notConfigured', null, null, e.message);
    case 400:
      return new VaultLockError('weak', null, null, e.message);
    default:
      return new VaultLockError('unknown', null, null, e?.message);
  }
}
