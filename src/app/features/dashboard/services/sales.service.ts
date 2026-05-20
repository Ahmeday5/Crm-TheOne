import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  SalesDashboardStats,
  SalesStatusCount,
} from '../../../shared/models';

/**
 * HTTP boundary for the sales dashboard + sales-analysis widgets.
 *
 * Reads use a `SHORT` cache so revisiting the page within a short window
 * skips the network — matches the cadence the user actually navigates at.
 */
@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly api = inject(ApiService);

  /** KPI strip on top of the sales dashboard. */
  dashboardStatistics(): Observable<SalesDashboardStats> {
    return this.api.get<SalesDashboardStats>(
      API_ENDPOINTS.sales.dashboardStatistics,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  /** Per-status counts for the pipeline chart on the sales dashboard. */
  customerStatusCount(): Observable<SalesStatusCount[]> {
    return this.api.get<SalesStatusCount[]>(
      API_ENDPOINTS.sales.customerStatusCount,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  /**
   * Distinct free-text reasons sales reps have entered when marking a
   * customer as `NotBuyer`. The response is a plain string array, no
   * envelope — the API service unwraps the standard envelope, and a raw
   * payload would pass through `unwrap()` untouched.
   */
  notBuyingReasons(): Observable<string[]> {
    return this.api.get<string[]>(API_ENDPOINTS.sales.notBuyingReasons, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }
}
