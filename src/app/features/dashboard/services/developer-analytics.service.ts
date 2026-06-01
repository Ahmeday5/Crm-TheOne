import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  BugAnalytics,
  DeveloperAnalyticsCharts,
  DeveloperAnalyticsSummary,
  DeveloperStatRow,
} from '../../../shared/models';

/**
 * HTTP boundary for the `DeveloperAnalytics/*` endpoints behind the
 * "Development team analytics" page. None take query params, so filtering is
 * applied client-side by the page component.
 */
@Injectable({ providedIn: 'root' })
export class DeveloperAnalyticsService {
  private readonly api = inject(ApiService);

  summary(): Observable<DeveloperAnalyticsSummary> {
    return this.api.get<DeveloperAnalyticsSummary>(
      API_ENDPOINTS.developerAnalytics.summary,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  developerStats(): Observable<DeveloperStatRow[]> {
    return this.api.get<DeveloperStatRow[]>(
      API_ENDPOINTS.developerAnalytics.developerStats,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  charts(): Observable<DeveloperAnalyticsCharts> {
    return this.api.get<DeveloperAnalyticsCharts>(
      API_ENDPOINTS.developerAnalytics.charts,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  bugAnalytics(): Observable<BugAnalytics> {
    return this.api.get<BugAnalytics>(
      API_ENDPOINTS.developerAnalytics.bugAnalytics,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }
}
