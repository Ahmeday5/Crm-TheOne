import { Observable } from 'rxjs';
import { VaultLockStatus, VaultUnlockResult } from '../models/vault-lock.models';

/**
 * Port for the vault page lock; failures surface as `VaultLockError`.
 * Bound to `HttpVaultLockGateway` in `vault-lock-gateway.provider.ts`.
 */
export abstract class VaultLockGateway {
  abstract status(): Observable<VaultLockStatus>;
  /** First time only — creates the password (then the caller unlocks with it). */
  abstract setup(password: string): Observable<void>;
  abstract unlock(password: string): Observable<VaultUnlockResult>;
  /** Revokes every open vault session, including the caller's. */
  abstract changePassword(currentPassword: string, newPassword: string): Observable<void>;
}
