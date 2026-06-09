import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheBypass,
  withCacheInvalidate,
  withInlineHandling,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  CreateGoalRequest,
  Goal,
  GoalListQuery,
  GoalStats,
  SalesPerson,
  UpdateGoalRequest,
} from '../../../shared/models';

const GOALS_CACHE_KEYS = ['Goals'] as const;

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly api = inject(ApiService);

  getAll(query?: GoalListQuery, force = false): Observable<Goal[]> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<Goal[]>(API_ENDPOINTS.goals.list, {
      params: query as Record<string, unknown> | undefined,
      context: ctx,
    });
  }

  getMy(query?: GoalListQuery, force = false): Observable<Goal[]> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<Goal[]>(API_ENDPOINTS.goals.my, {
      params: query as Record<string, unknown> | undefined,
      context: ctx,
    });
  }

  getById(id: number): Observable<Goal> {
    return this.api.get<Goal>(API_ENDPOINTS.goals.byId(id));
  }

  stats(): Observable<GoalStats> {
    return this.api.get<GoalStats>(API_ENDPOINTS.goals.stats, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  create(payload: CreateGoalRequest): Observable<Goal> {
    return this.api.post<Goal>(API_ENDPOINTS.goals.create, payload, {
      context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
    });
  }

  update(id: number, payload: UpdateGoalRequest): Observable<Goal> {
    return this.api.put<Goal>(API_ENDPOINTS.goals.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
    });
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.goals.delete(id), {
      context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
    });
  }

  /** GET /Goals/{id}/stats — full goal stats for a single goal. */
  getGoalStats(id: number): Observable<Goal> {
    return this.api.get<Goal>(API_ENDPOINTS.goals.goalStats(id));
  }

  /** PATCH /Goals/{id}/progress — increments currentProgress by `value`. */
  updateProgress(id: number, value: number): Observable<Goal> {
    return this.api.patch<Goal>(
      API_ENDPOINTS.goals.progress(id),
      { value },
      { context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])) },
    );
  }

  getSalesPersons(): Observable<SalesPerson[]> {
    return this.api.get<SalesPerson[]>(API_ENDPOINTS.auth.sales, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }
}
