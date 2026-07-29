import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  AnalyticsPeriod,
  DeveloperAnalyticsAll,
  DeveloperAnalyticsProjectOption,
} from '../../../shared/models';

export interface DeveloperAnalyticsQuery {
  /** Admin only — omit to let the server default to the signed-in developer. */
  DeveloperId?: string;
  ProjectId?: number | null;
  Period?: AnalyticsPeriod;
}

@Injectable({ providedIn: 'root' })
export class DeveloperAnalyticsService {
  private readonly api = inject(ApiService);

  all(query: DeveloperAnalyticsQuery = {}): Observable<DeveloperAnalyticsAll> {
    return this.api.get<DeveloperAnalyticsAll>(
      API_ENDPOINTS.developerAnalytics.all,
      {
        params: query as Record<string, unknown>,
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
      },
    );
  }

  /** Admin may pass `developerId` to scope the list to that developer's projects. */
  projectOptions(developerId?: string): Observable<DeveloperAnalyticsProjectOption[]> {
    return this.api.get<DeveloperAnalyticsProjectOption[]>(
      API_ENDPOINTS.developerAnalytics.projectOptions,
      {
        params: developerId ? { developerId } : undefined,
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
      },
    );
  }
}
