/**
 * Centralised cache TTLs so tuning policy doesn't mean editing every service.
 *
 * The `HttpCacheService` mirrors entries to `localStorage`, so cached responses
 * survive a hard refresh — the TTL only governs how long a value is considered
 * fresh. Mutations always invalidate the relevant URL pattern explicitly via
 * `withCacheInvalidate([...])`, so a stale read is impossible after a write.
 *
 * Picking a TTL:
 *   - SHORT  (1 min)  — high-churn collections (search results, activity feeds)
 *   - MEDIUM (5 min)  — entity lists / detail reads. Default for most endpoints.
 *   - LONG   (30 min) — slow-changing reference data (countries, categories).
 *   - DAY    (24h)    — near-static lookups (currencies, locales).
 */
export const CACHE_TTL = {
  SHORT: 60_000,
  MEDIUM: 5 * 60_000,
  LONG: 30 * 60_000,
  DAY: 24 * 60 * 60_000,
} as const;
