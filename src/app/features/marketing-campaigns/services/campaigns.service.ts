import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  Campaign,
  CampaignDetails,
  CampaignDropdownItem,
  CampaignListQuery,
  CampaignPerformanceRow,
  CampaignsStatistics,
  CountryOption,
  CreateCampaignRequest,
  PagedResult,
} from '../../../shared/models';

/**
 * HTTP boundary for the `Campaigns/*` endpoints.
 *
 * Caching:
 *   - Reads are served from cache (`HttpCacheService`) within their TTL —
 *     entries persist to `localStorage`, so a hard refresh keeps the cache
 *     warm.
 *   - Mutations invalidate every cached URL containing `Campaigns` so the
 *     next list/detail read refetches automatically. That's the only way
 *     to drop a cached value before its TTL expires.
 *
 * Loaders / errors:
 *   - Mutations use `withInlineHandling()` so the modal/button owns the
 *     spinner; validation errors surface inside the dialog. The error
 *     interceptor still emits a toast on uncaught failures unless silenced.
 *   - `getById()` skips the global loader (the dialog has its own spinner)
 *     and reuses the cache, so reopening the same details modal is instant.
 */
@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly api = inject(ApiService);

  list(query: CampaignListQuery = {}): Observable<PagedResult<Campaign>> {
    return this.api.get<PagedResult<Campaign>>(API_ENDPOINTS.campaigns.list, {
      params: query as Record<string, unknown>,
      context: withCache({ ttlMs: CACHE_TTL.MEDIUM }),
    });
  }

  dropdown(): Observable<CampaignDropdownItem[]> {
    return this.api.get<CampaignDropdownItem[]>(
      API_ENDPOINTS.campaigns.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  /** Countries options list — long-TTL cache (rarely changes). */
  countriesDropdown(): Observable<CountryOption[]> {
    return this.api.get<CountryOption[]>(
      API_ENDPOINTS.campaigns.dropdownCountries,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  statistics(): Observable<CampaignsStatistics> {
    return this.api.get<CampaignsStatistics>(
      API_ENDPOINTS.campaigns.statistics,
      { context: withCache({ ttlMs: CACHE_TTL.MEDIUM }) },
    );
  }

  /** Per-campaign outcome breakdown (buyers / non-buyers / conversion). */
  performance(): Observable<CampaignPerformanceRow[]> {
    return this.api.get<CampaignPerformanceRow[]>(
      API_ENDPOINTS.campaigns.performance,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  getById(id: number): Observable<CampaignDetails> {
    return this.api.get<CampaignDetails>(API_ENDPOINTS.campaigns.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
    });
  }

  add(payload: CreateCampaignRequest): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.campaigns.add, payload, {
      context: withInlineHandling(withCacheInvalidate(['Campaigns'])),
    });
  }

  /**
   * Full-replace update. Body shape mirrors `add()` — backend reads the id
   * from the URL, not the body, so we don't include it here.
   */
  update(id: number, payload: CreateCampaignRequest): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.campaigns.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Campaigns'])),
    });
  }

  /**
   * Hard delete. Errors (e.g. FK constraint 409s) flow to the global toast
   * because the page has no inline error slot for delete; we only skip the
   * global loader so the row spinner is the single in-flight indicator.
   */
  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.campaigns.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Campaigns'])),
    });
  }

  toggleStatus(id: number): Observable<unknown> {
    return this.api.patch<unknown>(
      API_ENDPOINTS.campaigns.toggleStatus(id),
      null,
      { context: withSkipLoader(withCacheInvalidate(['Campaigns'])) },
    );
  }
}
