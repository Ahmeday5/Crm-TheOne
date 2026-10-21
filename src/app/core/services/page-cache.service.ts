import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpCacheService } from './http-cache.service';

/**
 * Remembers which cached GETs each page made, so a page can drop exactly
 * its own cache — including requests from child widgets it hosts — without
 * each service needing a `force` flag.
 *
 *   cache interceptor → track(key)          on every cacheable GET
 *   refresh button    → refreshCurrentPage() then the page reloads
 *
 * Eviction goes through `HttpCacheService.invalidateMany`, so it syncs to
 * other tabs and wakes `onCacheInvalidated()` listeners (e.g. widgets that
 * reload themselves).
 */
@Injectable({ providedIn: 'root' })
export class PageCacheService {
  private readonly router = inject(Router);
  private readonly cache = inject(HttpCacheService);

  /** page path → cache keys requested while it was active. */
  private readonly keysByPage = new Map<string, Set<string>>();

  track(key: string): void {
    const page = this.currentPage();
    let keys = this.keysByPage.get(page);
    if (!keys) this.keysByPage.set(page, (keys = new Set()));
    keys.add(key);
  }

  /** Evicts every cached response the current page has used. */
  refreshCurrentPage(): void {
    const keys = this.keysByPage.get(this.currentPage());
    if (keys?.size) this.cache.invalidateMany([...keys]);
  }

  private currentPage(): string {
    return this.router.url.split(/[?#]/)[0] || '/';
  }
}
