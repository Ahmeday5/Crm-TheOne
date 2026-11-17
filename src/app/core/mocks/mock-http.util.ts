import { Observable, defer, delay, interval, map, of, take, concat, throwError, timer, mergeMap } from 'rxjs';
import { ApiError } from '../models/api-response.model';
import { UploadEvent } from '../services/api.service';

/**
 * Helpers for in-memory contract mocks (see `CONTRACT_MOCKS`). They behave
 * like the real `ApiService`: async, deep-copied payloads, errors shaped as
 * `ApiError` with the contract's `reason` codes.
 */

const MIN_LATENCY = 250;
const MAX_LATENCY = 650;

function latency(): number {
  return MIN_LATENCY + Math.floor(Math.random() * (MAX_LATENCY - MIN_LATENCY));
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Answers `factory()` after a realistic delay; a thrown `ApiError` becomes an error notification. */
export function mockReply<T>(factory: () => T, ms = latency()): Observable<T> {
  return timer(ms).pipe(
    mergeMap(() => {
      try {
        return of(clone(factory()));
      } catch (e) {
        return throwError(() => e);
      }
    }),
  );
}

export function apiError(status: number, reason: string, message: string, retryAfterSec?: number): ApiError {
  return { status, reason, message, retryAfterSec, code: reason };
}

/** Throws inside a `mockReply` factory. */
export function fail(status: number, reason: string, message: string, retryAfterSec?: number): never {
  throw apiError(status, reason, message, retryAfterSec);
}

/** Simulated upload: progress ticks sized to the file, then `done`. */
export function mockUpload<T>(sizeBytes: number, factory: () => T): Observable<UploadEvent<T>> {
  const steps = Math.max(6, Math.min(30, Math.round(sizeBytes / (4 * 1024 * 1024))));
  const progress$ = interval(120).pipe(
    take(steps),
    map((i): UploadEvent<T> => ({ kind: 'progress', percent: Math.round(((i + 1) / steps) * 100) })),
  );
  const done$ = defer(() => mockReply(factory, 300)).pipe(map((data): UploadEvent<T> => ({ kind: 'done', data })));
  return concat(progress$, done$);
}

/** Paged slice in the backend's `{ pageIndex, pageSize, count, data }` shape. */
export function page<T>(all: T[], pageIndex = 1, pageSize = 20): { pageIndex: number; pageSize: number; count: number; data: T[] } {
  const start = (pageIndex - 1) * pageSize;
  return { pageIndex, pageSize, count: all.length, data: all.slice(start, start + pageSize) };
}

/** Tiny persisted store for a mock area — survives reloads, never throws. */
export class MockStore<T> {
  private state: T;

  constructor(
    private readonly key: string,
    seed: () => T,
  ) {
    this.state = this.read() ?? seed();
  }

  get(): T {
    return this.state;
  }

  update(mutate: (draft: T) => void): void {
    mutate(this.state);
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      /* private mode / quota — keep it in memory */
    }
  }

  private read(): T | null {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function randomToken(length = 43): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export { delay };
