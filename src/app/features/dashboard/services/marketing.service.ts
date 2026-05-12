import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  DailyCustomersPoint,
  MarketingDashboardStats,
  SalesAnalysisStats,
  SourcePerformanceItem,
} from '../../../shared/models';

/**
 * HTTP boundary for the marketing dashboard widgets.
 *
 * All reads are cached at `SHORT` TTL — the dashboard refreshes whenever
 * the user navigates back to it, and the cache absorbs rapid re-mounts
 * (e.g. tab switching) without re-hitting the network.
 */
@Injectable({ providedIn: 'root' })
export class MarketingService {
  private readonly api = inject(ApiService);

  /** 4 KPIs for the dashboard cards row. */
  statistics(): Observable<MarketingDashboardStats> {
    return this.api.get<MarketingDashboardStats>(API_ENDPOINTS.marketing.statistics, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  /** Per-channel customer + budget breakdown for the platform chart. */
  sourcePerformance(): Observable<SourcePerformanceItem[]> {
    return this.api.get<SourcePerformanceItem[]>(
      API_ENDPOINTS.marketing.sourcePerformance,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  /** Daily potential-customers counts for the trailing 7 days. */
  last7Days(): Observable<DailyCustomersPoint[]> {
    return this.api.get<DailyCustomersPoint[]>(API_ENDPOINTS.marketing.last7Days, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  /** Sales-analysis KPIs (buyers / non-buyers / conversion rate). */
  salesStatistics(): Observable<SalesAnalysisStats> {
    return this.api.get<SalesAnalysisStats>(API_ENDPOINTS.marketing.salesStatistics, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }
}
