import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheBypass,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { SalesPipeline, SalesPipelineQuery } from '../models/sales-pipeline.model';

/**
 * HTTP boundary for the sales Kanban board (`GET /Sales/Pipeline`).
 *
 * Customer mutations already invalidate every cached `Sales` URL (see
 * `CustomersService`), so a status change drops this cache too.
 */
@Injectable({ providedIn: 'root' })
export class SalesPipelineService {
  private readonly api = inject(ApiService);

  /**
   * @param force  skip the cache (manual refresh / after a drag).
   * @param quiet  don't show the global loader (background refresh, "load more").
   */
  board(query: SalesPipelineQuery, force = false, quiet = false): Observable<SalesPipeline> {
    let ctx = withCache({ ttlMs: CACHE_TTL.SHORT });
    if (force) ctx = withCacheBypass(ctx);
    if (quiet) ctx = withSkipLoader(ctx);
    return this.api.get<SalesPipeline>(API_ENDPOINTS.sales.pipeline, {
      params: query as Record<string, unknown>,
      context: ctx,
    });
  }
}
