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
  AdjustProgressDto,
  AssignProjectTeamDto,
  PagedResult,
  ProjectDailyReportListDto,
  ProjectDailyReportParams,
  ProjectDailyReportResponseDto,
  ProjectProgressHistoryDto,
  ProjectProgressSummaryDto,
  ProjectTeamMemberResponseDto,
} from '../../../shared/models';

const INVALIDATE_TAGS = ['ProjectProgress'];

/**
 * HTTP boundary for the `ProjectProgress/*` endpoints — team responsibility
 * assignment, earned-progress tracking + adjustments, and developer daily
 * reports. Every mutation invalidates cached `ProjectProgress` URLs so the
 * summary/team/report lists refetch fresh values (e.g. `hasReportedToday`).
 */
@Injectable({ providedIn: 'root' })
export class ProjectProgressService {
  private readonly api = inject(ApiService);

  // ─────────── team (Admin) ───────────

  getTeam(projectId: number): Observable<ProjectTeamMemberResponseDto[]> {
    return this.api.get<ProjectTeamMemberResponseDto[]>(
      API_ENDPOINTS.projectProgress.team(projectId),
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  assignTeam(projectId: number, payload: AssignProjectTeamDto): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.projectProgress.team(projectId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(INVALIDATE_TAGS)) },
    );
  }

  // ─────────── progress summary ───────────

  getSummary(projectId: number, force = false): Observable<ProjectProgressSummaryDto> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<ProjectProgressSummaryDto>(
      API_ENDPOINTS.projectProgress.summary(projectId),
      { context: ctx },
    );
  }

  getMyProgress(projectId: number, force = false): Observable<ProjectTeamMemberResponseDto> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<ProjectTeamMemberResponseDto>(
      API_ENDPOINTS.projectProgress.myProgress(projectId),
      { context: ctx },
    );
  }

  // ─────────── progress adjustment + history (Admin) ───────────

  adjustProgress(
    projectId: number,
    developerId: string,
    payload: AdjustProgressDto,
  ): Observable<unknown> {
    return this.api.put<unknown>(
      API_ENDPOINTS.projectProgress.adjust(projectId, developerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(INVALIDATE_TAGS)) },
    );
  }

  getHistory(
    projectId: number,
    developerId?: string,
  ): Observable<ProjectProgressHistoryDto[]> {
    return this.api.get<ProjectProgressHistoryDto[]>(
      API_ENDPOINTS.projectProgress.history(projectId),
      {
        params: developerId ? { developerId } : undefined,
        context: withSkipLoader(withCacheBypass()),
      },
    );
  }

  // ─────────── daily reports ───────────

  createReport(form: FormData): Observable<ProjectDailyReportResponseDto> {
    return this.api.post<ProjectDailyReportResponseDto>(
      API_ENDPOINTS.projectProgress.reports.create,
      form,
      { context: withInlineHandling(withCacheInvalidate(INVALIDATE_TAGS)) },
    );
  }

  updateReport(reportId: number, form: FormData): Observable<ProjectDailyReportResponseDto> {
    return this.api.put<ProjectDailyReportResponseDto>(
      API_ENDPOINTS.projectProgress.reports.update(reportId),
      form,
      { context: withInlineHandling(withCacheInvalidate(INVALIDATE_TAGS)) },
    );
  }

  getReportById(reportId: number): Observable<ProjectDailyReportResponseDto> {
    return this.api.get<ProjectDailyReportResponseDto>(
      API_ENDPOINTS.projectProgress.reports.byId(reportId),
      { context: withSkipLoader(withCacheBypass()) },
    );
  }

  getProjectReports(
    projectId: number,
    params: ProjectDailyReportParams = {},
  ): Observable<PagedResult<ProjectDailyReportListDto>> {
    return this.api.get<PagedResult<ProjectDailyReportListDto>>(
      API_ENDPOINTS.projectProgress.reports.byProject(projectId),
      { params: params as Record<string, unknown>, context: withCacheBypass() },
    );
  }

  getMyReports(
    params: ProjectDailyReportParams = {},
  ): Observable<PagedResult<ProjectDailyReportListDto>> {
    return this.api.get<PagedResult<ProjectDailyReportListDto>>(
      API_ENDPOINTS.projectProgress.reports.my,
      { params: params as Record<string, unknown>, context: withCacheBypass() },
    );
  }
}
