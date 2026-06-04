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
  AppService,
  CreateSupportTicketRequest,
  CustomerDropdownItem,
  PagedResult,
  SupportDashboard,
  SupportTicket,
  SupportTicketListQuery,
  SupportTicketStatistics,
  UpdateSupportTicketRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for the `SupportTickets/*` endpoints, plus the customer and
 * service pickers the create/edit dialog needs.
 *
 * The list endpoint returns the generic `{ pageIndex, pageSize, count, data }`
 * envelope and supports server-side search (`Search`) + filtering by status /
 * priority *enum name* (`Status=InProgress`, `Priority=High`).
 *
 * Mutations carry `withInlineHandling` (the dialog shows errors inline) and
 * invalidate every cached `SupportTickets` URL so the list + statistics
 * refetch on the next read.
 */
@Injectable({ providedIn: 'root' })
export class SupportTicketsService {
  private readonly api = inject(ApiService);

  // ─────────── reads ───────────

  list(query: SupportTicketListQuery = {}): Observable<PagedResult<SupportTicket>> {
    return this.api.get<PagedResult<SupportTicket>>(
      API_ENDPOINTS.supportTickets.list,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  getById(id: number): Observable<SupportTicket> {
    return this.api.get<SupportTicket>(API_ENDPOINTS.supportTickets.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  statistics(): Observable<SupportTicketStatistics> {
    return this.api.get<SupportTicketStatistics>(
      API_ENDPOINTS.supportTickets.statistics,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
  }

  /**
   * KPI strip + status breakdown + trailing-7-days "resolved" trend for the
   * support dashboard (`GET /Support/Dashboard`). SHORT cache — the page is
   * revisited often and the numbers don't need to be second-fresh.
   */
  dashboard(): Observable<SupportDashboard> {
    return this.api.get<SupportDashboard>(API_ENDPOINTS.support.dashboard, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  // ─────────── mutations ───────────

  create(payload: CreateSupportTicketRequest): Observable<SupportTicket> {
    return this.api.post<SupportTicket>(
      API_ENDPOINTS.supportTickets.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['SupportTickets', 'Support', 'AdminDashboard'])) },
    );
  }

  update(
    id: number,
    payload: UpdateSupportTicketRequest,
  ): Observable<SupportTicket> {
    return this.api.put<SupportTicket>(
      API_ENDPOINTS.supportTickets.update(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['SupportTickets', 'Support', 'AdminDashboard'])) },
    );
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.supportTickets.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['SupportTickets', 'Support', 'AdminDashboard'])),
    });
  }

  // ─────────── pickers ───────────

  /** Customer picker (id + company + their services) — shared dropdown source. */
  customersDropdown(): Observable<CustomerDropdownItem[]> {
    return this.api.get<CustomerDropdownItem[]>(
      API_ENDPOINTS.customers.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  /** Bilingual service list (id + nameAr/nameEn) for the service picker. */
  servicesDropdown(): Observable<AppService[]> {
    return this.api
      .get<PagedResult<AppService>>(API_ENDPOINTS.services.list, {
        params: { PageIndex: 1, PageSize: 1000 },
        context: withCache({ ttlMs: CACHE_TTL.LONG }),
      })
      .pipe(map((page) => page.data ?? []));
  }
}
