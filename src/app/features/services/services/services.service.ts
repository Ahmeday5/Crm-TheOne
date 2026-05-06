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
  AppService,
  PagedQuery,
  PagedResult,
  UpsertServiceRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for the `Services/*` endpoints.
 *
 * The list endpoint returns `{ pageIndex, pageSize, count, data: AppService[] }`
 * — server-side pagination + search by `Search` query string.
 *
 * Caching:
 *   - `list()` and `getById()` are cached for the medium TTL (5 min) and
 *     persist to `localStorage`, so a hard refresh keeps the cache warm.
 *   - Mutations (`add` / `update` / `delete`) invalidate every cached
 *     `Services` URL so the next read refetches.
 */
@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly api = inject(ApiService);

  list(query: PagedQuery = {}): Observable<PagedResult<AppService>> {
    const params: Record<string, unknown> = {
      Search: query.search,
      PageIndex: query.pageIndex,
      PageSize: query.pageSize,
    };
    return this.api.get<PagedResult<AppService>>(API_ENDPOINTS.services.list, {
      params,
      context: withCache({ ttlMs: CACHE_TTL.MEDIUM }),
    });
  }

  getById(id: number): Observable<AppService> {
    return this.api.get<AppService>(API_ENDPOINTS.services.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
    });
  }

  add(payload: UpsertServiceRequest): Observable<AppService> {
    return this.api.post<AppService>(API_ENDPOINTS.services.add, payload, {
      context: withInlineHandling(withCacheInvalidate(['Services'])),
    });
  }

  update(id: number, payload: UpsertServiceRequest): Observable<AppService> {
    return this.api.put<AppService>(API_ENDPOINTS.services.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Services'])),
    });
  }

  /**
   * Errors (FK conflicts, 409s, etc.) flow to the global toast — the page
   * has no inline error slot for delete, so the user must see the failure.
   * Only the global loader is skipped so the row spinner remains the
   * single in-flight indicator.
   */
  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.services.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Services'])),
    });
  }
}
