/**
 * The vault page lock: a password separate from the login, set once by an
 * admin. Every visitor — even another admin — must enter it to open the vault.
 * A successful unlock returns a short-lived vault token that the vault API
 * calls carry (`X-Vault-Token`).
 */

export interface VaultLockStatus {
  isConfigured: boolean;
  /** How long one unlock lasts. */
  unlockMinutes: number;
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
    /** The server's own (Arabic) message, when it sent one. */
    readonly serverMessage: string | null = null,
  ) {
    super(code);
  }
}

/** Backend rule: 8–128 characters. Letter + digit are only a strength hint. */
export const VAULT_PASSWORD_MIN = 8;
export const VAULT_PASSWORD_MAX = 128;

export interface PasswordCheck {
  length: boolean;
  letter: boolean;
  digit: boolean;
}

export function checkVaultPassword(pw: string): PasswordCheck {
  return {
    length: pw.length >= VAULT_PASSWORD_MIN && pw.length <= VAULT_PASSWORD_MAX,
    letter: /[A-Za-z؀-ۿ]/.test(pw),
    digit: /\d/.test(pw),
  };
}

/** What the server accepts (length only). */
export function isStrongEnough(pw: string): boolean {
  return checkVaultPassword(pw).length;
}

/** 0–4 strength for the meter: valid length, a letter, a digit, 12+ characters. */
export function passwordStrength(pw: string): number {
  const c = checkVaultPassword(pw);
  if (!c.length) return 0;
  return 1 + Number(c.letter) + Number(c.digit) + Number(pw.length >= 12);
}
