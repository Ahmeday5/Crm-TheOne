import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
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
  AddGoalProgressRequest,
  CreateGoalRequest,
  Goal,
  GoalLeaderboardEntry,
  GoalLeaderboardQuery,
  GoalListQuery,
  GoalStats,
  SalesPerson,
  UpdateGoalProgressEntryRequest,
  UpdateGoalRequest,
} from '../../../shared/models';

const GOALS_CACHE_KEYS = ['Goals'] as const;

type LeaderboardPayload =
  | GoalLeaderboardEntry[]
  | { items?: GoalLeaderboardEntry[]; data?: GoalLeaderboardEntry[] }
  | null;

function toLeaderboardRows(payload: LeaderboardPayload): GoalLeaderboardEntry[] {
  const rows = Array.isArray(payload) ? payload : payload?.items ?? payload?.data;
  if (!Array.isArray(rows)) return [];
  // The list is already ranked server-side; fill in `rank` if it is omitted.
  return rows.map((row, i) => ({
    ...row,
    rank: Number(row.rank) || i + 1,
    totalPoints: Number(row.totalPoints) || 0,
    totalReward: Number(row.totalReward) || 0,
    goalsAchieved: Number(row.goalsAchieved) || 0,
  }));
}

function isGoal(value: unknown): value is Goal {
  return !!value && typeof value === 'object' && 'id' in value && 'targetValue' in value;
}

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

  /** GET /Goals/{id} — full goal including `progressEntries` (never cached: it's an audit trail). */
  getById(id: number): Observable<Goal> {
    return this.api.get<Goal>(API_ENDPOINTS.goals.byId(id), {
      context: withSkipLoader(),
    });
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

  /**
   * PATCH /Goals/{id}/progress (Sales) — logs an amount against the goal.
   * Multipart; `UserId` / `AttachmentUrl` are filled server-side and never sent.
   * Resolves to the full, updated goal.
   */
  addProgress(id: number, req: AddGoalProgressRequest): Observable<Goal> {
    const form = new FormData();
    form.append('Value', String(req.value));
    form.append('Details', req.details);
    if (req.attachment) form.append('attachment', req.attachment, req.attachment.name);

    return this.api.patch<Goal>(API_ENDPOINTS.goals.progress(id), form, {
      context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
    });
  }

  /**
   * PUT /Goals/progress-entries/{entryId} (Admin) — edits one logged amount.
   * Only the fields present on `req` are sent. Resolves to the updated goal.
   */
  updateProgressEntry(entryId: number, req: UpdateGoalProgressEntryRequest): Observable<Goal> {
    const form = new FormData();
    if (req.value !== undefined) form.append('Value', String(req.value));
    if (req.details !== undefined) form.append('Details', req.details);
    if (req.attachment) form.append('attachment', req.attachment, req.attachment.name);
    if (req.removeAttachment) form.append('RemoveAttachment', 'true');

    return this.api.put<Goal>(API_ENDPOINTS.goals.progressEntry(entryId), form, {
      context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
    });
  }

  /**
   * DELETE /Goals/progress-entries/{entryId} (Admin) — removes one logged
   * amount; the goal's progress is recalculated server-side.
   *
   * Resolves to the updated goal. When the server answers without a goal
   * body, it is re-read so callers always get the recalculated totals.
   */
  deleteProgressEntry(entryId: number, goalId: number): Observable<Goal> {
    return this.api
      .delete<Goal | null>(API_ENDPOINTS.goals.progressEntry(entryId), {
        context: withInlineHandling(withCacheInvalidate([...GOALS_CACHE_KEYS])),
      })
      .pipe(switchMap((res) => (isGoal(res) ? of(res) : this.getById(goalId))));
  }

  /**
   * GET /Goals/Leaderboard — ranked by points earned.
   *
   * Always resolves to an array: the endpoint has no documented response
   * schema, so a paged envelope (`{ items }` / `{ data }`) is unwrapped too.
   * Pass `force` for user-initiated refreshes — the cache is mirrored to
   * localStorage, so without it an earlier (e.g. empty) board keeps showing.
   */
  leaderboard(query?: GoalLeaderboardQuery, force = false): Observable<GoalLeaderboardEntry[]> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api
      .get<LeaderboardPayload>(API_ENDPOINTS.goals.leaderboard, {
        params: query as Record<string, unknown> | undefined,
        context: ctx,
      })
      .pipe(map(toLeaderboardRows));
  }

  /** GET /Goals/active — the caller's own active goal(s); disappears once the end date passes. */
  getActive(force = false): Observable<Goal[]> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<Goal[]>(API_ENDPOINTS.goals.active, { context: ctx });
  }

  getSalesPersons(): Observable<SalesPerson[]> {
    return this.api.get<SalesPerson[]>(API_ENDPOINTS.auth.sales, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }
}
