/**
 * The vault page lock: a password separate from the login, set once by an
 * admin. Every visitor — even another admin — must enter it to open the vault.
 * A successful unlock returns a short-lived vault token that the vault API
 * calls carry (`X-Vault-Token`).
 */

export interface VaultLockStatus {
  isConfigured: boolean;
}

export interface VaultUnlockResult {
  vaultToken: string;
  /** UTC ISO timestamp — the page re-locks itself at this moment. */
  expiresAt: string;
}

export type VaultLockErrorCode =
  /** Wrong password. */
  | 'wrong'
  /** Too many wrong attempts — wait `retryAfterSec`. */
  | 'lockedOut'
  /** Setup called after a password already exists (another admin was first). */
  | 'alreadyConfigured'
  /** Unlock / change called before any password exists. */
  | 'notConfigured'
  /** The new password doesn't meet the rules. */
  | 'weak'
  | 'unknown';

export class VaultLockError extends Error {
  constructor(
    readonly code: VaultLockErrorCode,
    readonly attemptsLeft: number | null = null,
    readonly retryAfterSec: number | null = null,
  ) {
    super(code);
  }
}

/** Client-side password rules (the backend enforces the same). */
export const VAULT_PASSWORD_MIN = 8;

export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  digit: boolean;
}

export function checkVaultPassword(pw: string): PasswordCheck {
  return {
    length: pw.length >= VAULT_PASSWORD_MIN,
    letter: /[A-Za-z؀-ۿ]/.test(pw),
    digit: /\d/.test(pw),
  };
}

export function isStrongEnough(pw: string): boolean {
  const c = checkVaultPassword(pw);
  return c.length && c.letter && c.digit;
}
