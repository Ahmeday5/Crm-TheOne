import { Injectable } from '@angular/core';
import { Observable, defer, delay, from, map, of, switchMap, throwError } from 'rxjs';
import { VaultLockError, VaultLockStatus, VaultUnlockResult, isStrongEnough } from '../models/vault-lock.models';
import { VaultLockGateway } from './vault-lock-gateway';

/** Matches the backend contract: short-lived unlock. */
const TOKEN_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const LATENCY_MS = 400;
const STORAGE_KEY = 'crm.mock.vaultLock';

interface StoredLock {
  salt: string;
  hash: string;
}

/** Attempt counter lives in memory (the real server tracks it per user + IP). */
let failed = 0;
let lockedUntil = 0;

/**
 * TEMPORARY adapter — design preview only. Keeps a salted hash in this
 * browser's localStorage so the flow (first-time setup → unlock → change) can
 * be tried end-to-end. The real server keeps the hash; nothing here is a
 * security boundary — the backend's `X-Vault-Token` check is.
 */
@Injectable()
export class MockVaultLockGateway extends VaultLockGateway {
  status(): Observable<VaultLockStatus> {
    return of({ isConfigured: !!readLock() }).pipe(delay(150));
  }

  setup(password: string): Observable<VaultUnlockResult> {
    if (readLock()) return fail(new VaultLockError('alreadyConfigured'));
    if (!isStrongEnough(password)) return fail(new VaultLockError('weak'));
    const salt = randomHex(16);
    return from(hash(salt, password)).pipe(
      map((h) => {
        writeLock({ salt, hash: h });
        return issueToken();
      }),
      delay(LATENCY_MS),
    );
  }

  unlock(password: string): Observable<VaultUnlockResult> {
    return defer(() => {
      const lock = readLock();
      if (!lock) return throwError(() => new VaultLockError('notConfigured'));
      const now = Date.now();
      if (lockedUntil > now) {
        return throwError(() => new VaultLockError('lockedOut', 0, Math.ceil((lockedUntil - now) / 1000)));
      }
      return from(hash(lock.salt, password)).pipe(
        switchMap((h) => {
          if (h === lock.hash) {
            failed = 0;
            return of(issueToken());
          }
          failed++;
          if (failed >= MAX_ATTEMPTS) {
            failed = 0;
            lockedUntil = Date.now() + LOCKOUT_MS;
            return throwError(() => new VaultLockError('lockedOut', 0, LOCKOUT_MS / 1000));
          }
          return throwError(() => new VaultLockError('wrong', MAX_ATTEMPTS - failed));
        }),
      );
    }).pipe(delay(LATENCY_MS));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return defer(() => {
      const lock = readLock();
      if (!lock) return throwError(() => new VaultLockError('notConfigured'));
      if (!isStrongEnough(newPassword)) return throwError(() => new VaultLockError('weak'));
      return from(hash(lock.salt, currentPassword)).pipe(
        switchMap((h) => {
          if (h !== lock.hash) return throwError(() => new VaultLockError('wrong'));
          const salt = randomHex(16);
          return from(hash(salt, newPassword)).pipe(map((nh) => writeLock({ salt, hash: nh })));
        }),
      );
    }).pipe(delay(LATENCY_MS));
  }
}

// ── helpers ──

function fail<T>(err: VaultLockError): Observable<T> {
  return throwError(() => err).pipe(delay(LATENCY_MS));
}

function issueToken(): VaultUnlockResult {
  return { vaultToken: `mock-${randomHex(24)}`, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString() };
}

function readLock(): StoredLock | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredLock) : null;
    return parsed?.salt && parsed?.hash ? parsed : null;
  } catch {
    return null;
  }
}

function writeLock(lock: StoredLock): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lock));
  } catch {
    /* private mode — the preview just won't remember the password */
  }
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 when available (secure contexts); FNV-1a fallback on plain http (mock only). */
async function hash(salt: string, password: string): Promise<string> {
  const input = `${salt}:${password}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
