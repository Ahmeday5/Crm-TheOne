import { Observable } from 'rxjs';
import { VaultLockStatus, VaultUnlockResult } from '../models/vault-lock.models';

/**
 * Port for the vault page lock. Failures surface as `VaultLockError` (the HTTP
 * adapter maps 401 → `wrong`, 429 → `lockedOut`, 409 → `alreadyConfigured`).
 *
 * Today: `MockVaultLockGateway`. Production: `HttpVaultLockGateway` on
 * `API_ENDPOINTS.vault.lockStatus|lockSetup|unlock|lockChangePassword`, bound in
 * `vault-lock-gateway.provider.ts`.
 */
export abstract class VaultLockGateway {
  abstract status(): Observable<VaultLockStatus>;
  /** First time only — creates the password and unlocks right away. */
  abstract setup(password: string): Observable<VaultUnlockResult>;
  abstract unlock(password: string): Observable<VaultUnlockResult>;
  /** Revokes every open vault token — the caller must unlock again. */
  abstract changePassword(currentPassword: string, newPassword: string): Observable<void>;
}
