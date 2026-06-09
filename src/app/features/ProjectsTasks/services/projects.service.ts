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
  CreateProjectRequest,
  CustomerDropdownItem,
  DeveloperOption,
  PagedResult,
  ProjectDetail,
  ProjectListItem,
  ProjectListQuery,
  UpdateProjectRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for the project-management feature.
 *
 * Two endpoint families share one service:
 *   - `ManagerProjects/*` — admin-only, full CRUD over every project.
 *   - `DeveloperProjects/*` — read-only, scoped to the signed-in developer.
 *
 * The list endpoints return the generic `{ pageIndex, pageSize, count, data }`
 * envelope and accept `PageIndex` / `PageSize` / `Search` query params.
 * Every mutation invalidates the cached `Projects` URLs so lists refetch.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(ApiService);

  // ─────────── admin (ManagerProjects) reads ───────────

  list(query: ProjectListQuery = {}, force = false): Observable<PagedResult<ProjectListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PagedResult<ProjectListItem>>(
      API_ENDPOINTS.managerProjects.list,
      { params: query as Record<string, unknown>, context: ctx },
    );
  }

  activeList(
    query: ProjectListQuery = {},
    force = false,
  ): Observable<PagedResult<ProjectListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PagedResult<ProjectListItem>>(
      API_ENDPOINTS.managerProjects.active,
      { params: query as Record<string, unknown>, context: ctx },
    );
  }

  getById(id: number): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(API_ENDPOINTS.managerProjects.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  // ─────────── admin (ManagerProjects) mutations ───────────

  create(payload: CreateProjectRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>(
      API_ENDPOINTS.managerProjects.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Projects', 'AdminDashboard'])) },
    );
  }

  update(id: number, payload: UpdateProjectRequest): Observable<unknown> {
    return this.api.put<unknown>(
      API_ENDPOINTS.managerProjects.update(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Projects', 'AdminDashboard'])) },
    );
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.managerProjects.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Projects', 'AdminDashboard'])),
    });
  }

  // ─────────── developer (DeveloperProjects) reads ───────────

  myList(query: ProjectListQuery = {}, force = false): Observable<PagedResult<ProjectListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PagedResult<ProjectListItem>>(
      API_ENDPOINTS.developerProjects.myProjects,
      { params: query as Record<string, unknown>, context: ctx },
    );
  }

  myActiveList(
    query: ProjectListQuery = {},
    force = false,
  ): Observable<PagedResult<ProjectListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PagedResult<ProjectListItem>>(
      API_ENDPOINTS.developerProjects.myActive,
      { params: query as Record<string, unknown>, context: ctx },
    );
  }

  myGetById(id: number): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(
      API_ENDPOINTS.developerProjects.myById(id),
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  // ─────────── dropdowns (add/edit form) ───────────

  /** Engineers picker — every developer the project can be assigned to. */
  developers(): Observable<DeveloperOption[]> {
    return this.api.get<DeveloperOption[]>(API_ENDPOINTS.auth.developers, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  /** Customer picker — same source the quotation/contract forms use. */
  customersDropdown(): Observable<CustomerDropdownItem[]> {
    return this.api.get<CustomerDropdownItem[]>(
      API_ENDPOINTS.customers.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }
}
