import { Injectable, computed, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
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
import { AuthService } from '../../../core/services/auth.service';
import {
  DailyReport,
  DailyReportListItem,
  DailyReportListQuery,
  DailyReportProjectRef,
  DailyReportRequest,
  PagedResult,
  ProjectListItem,
} from '../../../shared/models';
import { ProjectsService } from '../../ProjectsTasks/services/projects.service';
import { normalizeDailyReport, normalizeDailyReportListItem } from './daily-report.mapper';

/** Upper bound for the project picker — the active-projects endpoints are paged. */
const PROJECT_PICKER_SIZE = 100;

/**
 * HTTP boundary for the `Reports/*` (daily reports) endpoints.
 *
 * Two list endpoints share the same query / page envelope:
 *   - `list()`       — `GET /Reports` (admin: every user's reports)
 *   - `myReports()`  — `GET /Reports/myreports` (current user's reports)
 *
 * Every response goes through `daily-report.mapper.ts`, so `projects` /
 * `projectNames` are always arrays (older reports and cached pages included).
 *
 * Caching strategy mirrors `CampaignsService`: lists use a MEDIUM TTL and
 * every mutation invalidates anything containing `Reports`, so the next
 * read repopulates from the network.
 */
@Injectable({ providedIn: 'root' })
export class DailyReportsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly projects = inject(ProjectsService);

  /**
   * Only Admin (every active project) and Developers (their own active
   * projects) have a project endpoint to pick from — other roles write
   * reports without project links.
   */
  readonly canLinkProjects = computed(() => {
    const role = this.auth.currentRole();
    return role === 'Admin' || role === 'Developer';
  });

  /** Admin-scoped — returns every user's daily reports. */
  list(query: DailyReportListQuery = {}, force = false): Observable<PagedResult<DailyReportListItem>> {
    return this.page(API_ENDPOINTS.reports.list, query, force);
  }

  /** Caller-scoped — returns the signed-in user's daily reports. */
  myReports(query: DailyReportListQuery = {}, force = false): Observable<PagedResult<DailyReportListItem>> {
    return this.page(API_ENDPOINTS.reports.myReports, query, force);
  }

  getById(id: number): Observable<DailyReport> {
    return this.api
      .get<DailyReport>(API_ENDPOINTS.reports.byId(id), {
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
      })
      .pipe(map(normalizeDailyReport));
  }

  create(payload: DailyReportRequest): Observable<DailyReport> {
    return this.api
      .post<DailyReport>(API_ENDPOINTS.reports.create, payload, {
        context: withInlineHandling(withCacheInvalidate(['Reports'])),
      })
      .pipe(map(normalizeDailyReport));
  }

  update(id: number, payload: DailyReportRequest): Observable<DailyReport> {
    return this.api
      .put<DailyReport>(API_ENDPOINTS.reports.update(id), payload, {
        context: withInlineHandling(withCacheInvalidate(['Reports'])),
      })
      .pipe(map(normalizeDailyReport));
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.reports.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Reports'])),
    });
  }

  /** Projects the caller may link a report to (empty for roles without a project endpoint). */
  linkableProjects(): Observable<DailyReportProjectRef[]> {
    const role = this.auth.currentRole();
    const query = { PageIndex: 1, PageSize: PROJECT_PICKER_SIZE };
    const source$ =
      role === 'Admin'
        ? this.projects.activeList(query)
        : role === 'Developer'
          ? this.projects.myActiveList(query)
          : null;
    if (!source$) return of([]);
    return source$.pipe(
      map((page) =>
        (page?.data ?? [])
          .map((p: ProjectListItem): DailyReportProjectRef => ({ id: p.id, title: p.title }))
          .sort((a, b) => a.title.localeCompare(b.title)),
      ),
    );
  }

  private page(endpoint: string, query: DailyReportListQuery, force: boolean): Observable<PagedResult<DailyReportListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.MEDIUM }))
      : withCache({ ttlMs: CACHE_TTL.MEDIUM });
    return this.api
      .get<PagedResult<DailyReportListItem>>(endpoint, { params: query as Record<string, unknown>, context: ctx })
      .pipe(map((page) => ({ ...page, data: (page?.data ?? []).map(normalizeDailyReportListItem) })));
  }
}
