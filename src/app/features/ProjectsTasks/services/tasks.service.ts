import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  CreateTaskRequest,
  PagedResult,
  TaskControlPanel,
  TaskDetail,
  TaskListItem,
  TaskListQuery,
  TaskStatistics,
  UpdateMyTaskStatusRequest,
  UpdateTaskRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for the task-management feature.
 *
 *   - `ManagerTasks/*`   — admin-only, full CRUD + board statistics/control panel.
 *   - `DeveloperTasks/*` — scoped to the signed-in developer; reads plus a
 *                          status/hours-only update.
 *
 * List endpoints take `PageIndex` / `PageSize` / `Search` / `ProjectId` /
 * `Status` / `Priority`. Mutations invalidate the cached `Tasks` URLs.
 */
@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly api = inject(ApiService);

  // ─────────── admin (ManagerTasks) ───────────

  list(query: TaskListQuery = {}): Observable<PagedResult<TaskListItem>> {
    return this.api.get<PagedResult<TaskListItem>>(
      API_ENDPOINTS.managerTasks.list,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  getById(id: number): Observable<TaskDetail> {
    return this.api.get<TaskDetail>(API_ENDPOINTS.managerTasks.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  create(payload: CreateTaskRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>(
      API_ENDPOINTS.managerTasks.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Tasks'])) },
    );
  }

  update(id: number, payload: UpdateTaskRequest): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.managerTasks.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Tasks'])),
    });
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.managerTasks.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Tasks'])),
    });
  }

  statistics(): Observable<TaskStatistics> {
    return this.api.get<TaskStatistics>(API_ENDPOINTS.managerTasks.statistics, {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  controlPanel(): Observable<TaskControlPanel> {
    return this.api.get<TaskControlPanel>(
      API_ENDPOINTS.managerTasks.controlPanel,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  // ─────────── developer (DeveloperTasks) ───────────

  myList(query: TaskListQuery = {}): Observable<PagedResult<TaskListItem>> {
    return this.api.get<PagedResult<TaskListItem>>(
      API_ENDPOINTS.developerTasks.myTasks,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  myGetById(id: number): Observable<TaskDetail> {
    return this.api.get<TaskDetail>(API_ENDPOINTS.developerTasks.myById(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  updateMyStatus(
    id: number,
    payload: UpdateMyTaskStatusRequest,
  ): Observable<unknown> {
    return this.api.put<unknown>(
      API_ENDPOINTS.developerTasks.updateMyStatus(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Tasks'])) },
    );
  }

  myStatistics(): Observable<TaskStatistics> {
    return this.api.get<TaskStatistics>(
      API_ENDPOINTS.developerTasks.statistics,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  myControlPanel(): Observable<TaskControlPanel> {
    return this.api.get<TaskControlPanel>(
      API_ENDPOINTS.developerTasks.controlPanel,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }
}
