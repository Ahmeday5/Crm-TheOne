import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

interface PersistedShape<T = unknown> {
  v: number;
  e: CacheEntry<T>;
}

const PERSIST_VERSION = 1;
const STORAGE_PREFIX = 'crm_one_http_cache_v1::';
const BROADCAST_CHANNEL = 'crm-one-http-cache';
const SWEEP_INTERVAL_MS = 60_000;

type CrossTabMessage =
  | { type: 'set'; key: string }
  | { type: 'invalidate'; pattern: string }
  | { type: 'clear' };

export interface InvalidationEvent {
  pattern: string;
  ts: number;
}

/**
 * Smart HTTP cache.
 *
 *   - In-memory `Map` for O(1) reads.
 *   - localStorage mirror so a hard refresh keeps the cache (TTL respected).
 *   - BroadcastChannel sync so a write in tab A is visible to tab B.
 *   - Background sweep every minute drops expired entries.
 *
 * Mutations call `invalidate(pattern)` (substring match against the URL key)
 * to drop stale slices.
 */
@Injectable({ providedIn: 'root' })
export class HttpCacheService {
  private readonly storage = inject(StorageService);
  private readonly mem = new Map<string, CacheEntry>();
  private channel: BroadcastChannel | null = null;

  private readonly invalidationSignal = signal<InvalidationEvent>({
    pattern: '',
    ts: 0,
  });
  /**
   * Bumps every time a cache key is invalidated (locally OR from another
   * tab). Pages can `effect()` on this to auto-refetch when their pattern
   * matches.
   */
  readonly invalidations = this.invalidationSignal.asReadonly();

  constructor() {
    this.hydrateFromStorage();
    this.initCrossTabSync();
    this.scheduleSweep();
  }

  // ─────────────── public API ───────────────

  get<T>(key: string): T | null {
    const entry = this.mem.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.evict(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttlMs,
    };
    this.mem.set(key, entry as CacheEntry);
    this.persist(key, entry);
    this.broadcast({ type: 'set', key });
  }

  invalidate(pattern: string): void {
    if (!pattern) return;
    for (const key of [...this.mem.keys()]) {
      if (key.includes(pattern)) this.evict(key);
    }
    this.broadcast({ type: 'invalidate', pattern });
    this.invalidationSignal.set({ pattern, ts: Date.now() });
  }

  invalidateMany(patterns: readonly string[]): void {
    for (const p of patterns) this.invalidate(p);
  }

  clear(): void {
    for (const key of [...this.mem.keys()]) this.evict(key);
    this.broadcast({ type: 'clear' });
  }

  // ─────────────── persistence ───────────────

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const now = Date.now();
    const toRemove: string[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (!fullKey?.startsWith(STORAGE_PREFIX)) continue;
        const raw = localStorage.getItem(fullKey);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw) as PersistedShape;
          if (parsed.v !== PERSIST_VERSION || now >= parsed.e.expiresAt) {
            toRemove.push(fullKey);
            continue;
          }
          const cacheKey = fullKey.slice(STORAGE_PREFIX.length);
          this.mem.set(cacheKey, parsed.e);
        } catch {
          toRemove.push(fullKey);
        }
      }
    } catch {
      /* ignore */
    }

    for (const k of toRemove) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
  }

  private persist(key: string, entry: CacheEntry): void {
    const fullKey = STORAGE_PREFIX + key;
    const payload: PersistedShape = { v: PERSIST_VERSION, e: entry };
    try {
      this.storage.set(fullKey, JSON.stringify(payload));
    } catch {
      this.evictOldestPersisted(20);
      try { this.storage.set(fullKey, JSON.stringify(payload)); } catch { /* give up */ }
    }
  }

  private evict(key: string): void {
    this.mem.delete(key);
    this.storage.remove(STORAGE_PREFIX + key);
  }

  private evictOldestPersisted(count: number): void {
    if (typeof localStorage === 'undefined') return;
    const entries: { key: string; cachedAt: number }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (!fullKey?.startsWith(STORAGE_PREFIX)) continue;
        const raw = localStorage.getItem(fullKey);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as PersistedShape;
          entries.push({ key: fullKey, cachedAt: parsed.e.cachedAt });
        } catch {
          /* ignore */
        }
      }
    } catch {
      return;
    }
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    for (const { key } of entries.slice(0, count)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  }

  // ─────────────── cross-tab ───────────────

  private initCrossTabSync(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
      this.channel.onmessage = (e) =>
        this.onCrossTabMessage(e.data as CrossTabMessage);
    } catch {
      this.channel = null;
    }
  }

  private onCrossTabMessage(msg: CrossTabMessage): void {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'clear') {
      for (const key of [...this.mem.keys()]) {
        this.mem.delete(key);
        this.storage.remove(STORAGE_PREFIX + key);
      }
      return;
    }

    if (msg.type === 'invalidate') {
      for (const key of [...this.mem.keys()]) {
        if (key.includes(msg.pattern)) {
          this.mem.delete(key);
          this.storage.remove(STORAGE_PREFIX + key);
        }
      }
      this.invalidationSignal.set({ pattern: msg.pattern, ts: Date.now() });
      return;
    }

    if (msg.type === 'set') {
      const raw = this.storage.get(STORAGE_PREFIX + msg.key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as PersistedShape;
        if (parsed.v === PERSIST_VERSION && Date.now() < parsed.e.expiresAt) {
          this.mem.set(msg.key, parsed.e);
        }
      } catch {
        /* ignore */
      }
    }
  }

  private broadcast(msg: CrossTabMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      /* channel closed — ignore */
    }
  }

  // ─────────────── background sweep ───────────────

  private scheduleSweep(): void {
    if (typeof window === 'undefined') return;
    setInterval(() => this.sweepExpired(), SWEEP_INTERVAL_MS);
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.mem.entries()) {
      if (now >= entry.expiresAt) this.evict(key);
    }
  }
}
