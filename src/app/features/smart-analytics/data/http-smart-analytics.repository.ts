import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  ContactSlot,
  ContactTimeQuery,
  CustomerTickets,
  MonthKey,
  RepMonthlyPerformance,
  RepReview,
  RepReviewInput,
  SourceQualityQuery,
  SourceQualityRow,
} from '../models/smart-analytics.models';
import { SmartAnalyticsRepository } from './smart-analytics.repository';

/**
 * Endpoint paths (relative to `environment.apiUrl`). Kept with the adapter
 * until the feature is wired; move them into `API_ENDPOINTS` when it ships.
 */
export const SMART_ANALYTICS_ENDPOINTS = {
  sources: 'SmartAnalytics/sources',
  contactTimes: 'SmartAnalytics/contact-times',
  customerHealth: 'SmartAnalytics/customer-health',
  performance: 'SmartAnalytics/performance',
  review: (repId: string, month: MonthKey) =>
    `SmartAnalytics/performance/${encodeURIComponent(month)}/${encodeURIComponent(repId)}/review`,
} as const;

/**
 * Real backend adapter — implements `docs/api/smart-analytics.md`.
 *
 * Reads skip the global loader: every section renders its own skeleton.
 */
@Injectable({ providedIn: 'root' })
export class HttpSmartAnalyticsRepository extends SmartAnalyticsRepository {
  private readonly api = inject(ApiService);

  readonly isDemo = false;

  sourceQuality(query: SourceQualityQuery): Observable<SourceQualityRow[]> {
    return this.list<SourceQualityRow>(SMART_ANALYTICS_ENDPOINTS.sources, {
      dimension: query.dimension,
      range: query.range,
    });
  }

  contactTimes(query: ContactTimeQuery): Observable<ContactSlot[]> {
    return this.list<ContactSlot>(SMART_ANALYTICS_ENDPOINTS.contactTimes, { range: query.range });
  }

  customerTickets(): Observable<CustomerTickets[]> {
    return this.list<CustomerTickets>(SMART_ANALYTICS_ENDPOINTS.customerHealth);
  }

  monthlyPerformance(month: MonthKey): Observable<RepMonthlyPerformance[]> {
    return this.list<RepMonthlyPerformance>(SMART_ANALYTICS_ENDPOINTS.performance, { month });
  }

  saveReview(repId: string, month: MonthKey, input: RepReviewInput): Observable<RepReview> {
    return this.api.put<RepReview>(SMART_ANALYTICS_ENDPOINTS.review(repId, month), input, {
      context: withInlineHandling(),
    });
  }

  private list<T>(endpoint: string, params?: Record<string, unknown>): Observable<T[]> {
    return this.api
      .get<T[]>(endpoint, { params, context: withSkipLoader(withInlineHandling()) })
      .pipe(map((rows) => rows ?? []));
  }
}
