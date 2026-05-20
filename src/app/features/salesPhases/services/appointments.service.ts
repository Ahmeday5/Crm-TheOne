import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
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
  Appointment,
  AppointmentAssignee,
  AppointmentCustomerOption,
  AppointmentListQuery,
  AppointmentPage,
  AppointmentRequest,
  AppointmentStats,
} from '../../../shared/models';

/** Roles allowed in the "assigned to" picker. */
const ASSIGNABLE_ROLES = new Set(['Admin', 'Support']);

/**
 * HTTP boundary for `Appointments/*` plus the two pickers the form needs
 * (assignable users + customers).
 *
 * Caching mirrors the rest of the sales services: reads are short-cached and
 * every mutation invalidates any cached `Appointments` URL so the list and
 * stats refetch automatically.
 *
 * The list endpoint serializes pagination as siblings of `data` (a flat
 * `{ statusCode, message, totalCount, …, data: [] }` envelope). The default
 * unwrap would peel `data` and lose `totalCount`, so the request opts out of
 * unwrap and `normalizePage()` reshapes either the flat or the nested form
 * into `AppointmentPage`.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly api = inject(ApiService);

  list(query: AppointmentListQuery = {}): Observable<AppointmentPage> {
    return this.api
      .get<unknown>(API_ENDPOINTS.appointments.list, {
        params: query as Record<string, unknown>,
        skipUnwrap: true,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      })
      .pipe(map((res) => this.normalizePage(res)));
  }

  getById(id: number): Observable<Appointment> {
    return this.api.get<Appointment>(API_ENDPOINTS.appointments.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  stats(): Observable<AppointmentStats> {
    return this.api.get<AppointmentStats>(API_ENDPOINTS.appointments.stats, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  create(payload: AppointmentRequest): Observable<Appointment> {
    return this.api.post<Appointment>(
      API_ENDPOINTS.appointments.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Appointments'])) },
    );
  }

  update(id: number, payload: AppointmentRequest): Observable<Appointment> {
    return this.api.put<Appointment>(
      API_ENDPOINTS.appointments.update(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Appointments'])) },
    );
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.appointments.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Appointments'])),
    });
  }

  /**
   * Users assignable to an appointment — Support + Admin only.
   *
   * `GET /Auth/GetAllUsers` historically didn't include a role; if no row
   * carries one we fall back to the full list rather than render an empty
   * picker.
   */
  assignableUsers(): Observable<AppointmentAssignee[]> {
    return this.api
      .get<AppointmentAssignee[]>(API_ENDPOINTS.users.list, {
        context: withCache({ ttlMs: CACHE_TTL.MEDIUM }),
      })
      .pipe(
        map((users) => {
          const rows = users ?? [];
          const filtered = rows.filter(
            (u) => u.role != null && ASSIGNABLE_ROLES.has(u.role),
          );
          return filtered.length ? filtered : rows;
        }),
      );
  }

  customersDropdown(): Observable<AppointmentCustomerOption[]> {
    return this.api.get<AppointmentCustomerOption[]>(
      API_ENDPOINTS.customers.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  /** Reshape the flat *or* nested paged envelope into `AppointmentPage`. */
  private normalizePage(res: unknown): AppointmentPage {
    const body = (res ?? {}) as Record<string, unknown>;
    // Flat envelope → metadata sits on `body`; nested → it sits on `body.data`.
    const page = Array.isArray(body['data'])
      ? body
      : ((body['data'] ?? {}) as Record<string, unknown>);
    const data = (page['data'] ?? []) as Appointment[];
    return {
      totalCount: Number(page['totalCount'] ?? page['count'] ?? data.length),
      pageIndex: Number(page['pageIndex'] ?? 1),
      pageSize: Number(page['pageSize'] ?? data.length),
      totalPages: Number(page['totalPages'] ?? 1),
      data,
    };
  }
}
