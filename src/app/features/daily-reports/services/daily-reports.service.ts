import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheBypass,
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  DailyReport,
  DailyReportListItem,
  DailyReportListQuery,
  DailyReportRequest,
  PagedResult,
} from '../../../shared/models';

/**
 * HTTP boundary for the `Reports/*` (daily reports) endpoints.
 *
 * Two list endpoints share the same query / page envelope:
 *   - `list()`       — `GET /Reports` (admin: every user's reports)
 *   - `myReports()`  — `GET /Reports/myreports` (current user's reports)
 *
 * Caching strategy mirrors `CampaignsService`: lists use a MEDIUM TTL and
 * every mutation invalidates anything containing `Reports`, so the next
 * read repopulates from the network.
 */
@Injectable({ providedIn: 'root' })
export class DailyReportsService {
  private readonly api = inject(ApiService);

  /** Admin-scoped — returns every user's daily reports. */
  list(query: DailyReportListQuery = {}, force = false): Observable<PagedResult<DailyReportListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.MEDIUM }))
      : withCache({ ttlMs: CACHE_TTL.MEDIUM });
    return this.api.get<PagedResult<DailyReportListItem>>(API_ENDPOINTS.reports.list, {
      params: query as Record<string, unknown>,
      context: ctx,
    });
  }

  /** Caller-scoped — returns the signed-in user's daily reports. */
  myReports(query: DailyReportListQuery = {}, force = false): Observable<PagedResult<DailyReportListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.MEDIUM }))
      : withCache({ ttlMs: CACHE_TTL.MEDIUM });
    return this.api.get<PagedResult<DailyReportListItem>>(API_ENDPOINTS.reports.myReports, {
      params: query as Record<string, unknown>,
      context: ctx,
    });
  }

  getById(id: number): Observable<DailyReport> {
    return this.api.get<DailyReport>(API_ENDPOINTS.reports.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
    });
  }

  create(payload: DailyReportRequest): Observable<DailyReport> {
    return this.api.post<DailyReport>(API_ENDPOINTS.reports.create, payload, {
      context: withInlineHandling(withCacheInvalidate(['Reports'])),
    });
  }

  update(id: number, payload: DailyReportRequest): Observable<DailyReport> {
    return this.api.put<DailyReport>(API_ENDPOINTS.reports.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Reports'])),
    });
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.reports.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Reports'])),
    });
  }
}
