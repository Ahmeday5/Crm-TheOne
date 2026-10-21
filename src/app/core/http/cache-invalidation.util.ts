import { effect, inject, untracked } from '@angular/core';
import { HttpCacheService } from '../services/http-cache.service';

/**
 * Runs `handler` whenever cached URLs matching `pattern` are invalidated
 * after the caller was created — by a mutation on another screen, a
 * dialog, or another browser tab (the cache syncs over BroadcastChannel).
 *
 *   onCacheInvalidated('Appointments', () => this.reload(true));
 *
 * Call it in an injection context (constructor / field initializer); the
 * subscription ends with the owning component. Handlers should be cheap to
 * repeat — e.g. skip when a load is already in flight.
 */
export function onCacheInvalidated(pattern: string, handler: () => void): void {
  const cache = inject(HttpCacheService);
  const since = Date.now();

  effect(() => {
    const event = cache.invalidations();
    if (event.ts <= since) return;
    const hit = event.patterns.some((p) => p.includes(pattern) || pattern.includes(p));
    if (hit) untracked(handler);
  });
}
