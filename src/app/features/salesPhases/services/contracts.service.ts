import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, map, reduce } from 'rxjs';
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
  ContractDetail,
  ContractListItem,
  CONTRACTS_MAX_PAGE_SIZE,
  ContractListQuery,
  ContractStatistics,
  CreateContractRequest,
  CustomerDropdownItem,
  PagedResult,
  SalesPerson,
  UpdateContractRequest,
  parseContractStatus,
} from '../../../shared/models';

/**
 * Field names the list DTO has used for the contract amount. The row's
 * value rendered as 0 for every contract because the list payload did not
 * carry it as `price`; reading the first numeric alias keeps the UI correct
 * whichever name the server serializes.
 */
const PRICE_KEYS = ['price', 'totalPrice', 'contractPrice', 'contractValue', 'value', 'amount', 'totalAmount'] as const;

function normalizePrice(row: ContractListItem): number {
  const raw = row as unknown as Record<string, unknown>;
  for (const key of PRICE_KEYS) {
    const n = typeof raw[key] === 'string' ? Number(raw[key]) : raw[key];
    if (typeof n === 'number' && Number.isFinite(n) && n !== 0) return n;
  }
  return Number(row.price) || 0;
}

function normalizeContractRow(row: ContractListItem): ContractListItem {
  return {
    ...row,
    price: normalizePrice(row),
    // Unknown / missing status is treated as active rather than silently
    // shown as "cancelled".
    status: parseContractStatus(row.status ?? row.statusName) ?? 'Active',
  };
}

/**
 * HTTP boundary for `Contracts/*` plus the customer picker used by the
 * add-contract dialog.
 *
 * Everything is server-side: `GetContracts` filters (status / expiringSoon /
 * search) and pages (`pageIndex`, `pageSize` ≤ 100, total in `count`), and
 * `ContractStatistics` owns every aggregate number. The server scopes both
 * to the caller (Admin → all, sales → own), so the client never counts rows.
 *
 * `status` arrives as a string enum ("Active" | "Expired" | "Cancelled");
 * rows are normalised through `parseContractStatus` so the UI never sees an
 * unexpected shape. Mutations invalidate every cached `Contracts` URL.
 */
/** Spec'd query names (camelCase); empty values are dropped by `ApiService`. */
function toListParams(q: ContractListQuery): Record<string, unknown> {
  return {
    pageIndex: q.pageIndex,
    pageSize: Math.min(Math.max(1, q.pageSize), CONTRACTS_MAX_PAGE_SIZE),
    search: q.search?.trim() || undefined,
    status: q.status,
    expiringSoon: q.expiringSoon ? true : undefined,
    salesPersonId: q.salesPersonId || undefined,
  };
}

function normalizeStatistics(raw: Partial<ContractStatistics> | null): ContractStatistics {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    totalContracts: n(raw?.totalContracts),
    activeContracts: n(raw?.activeContracts),
    expiringSoonContracts: n(raw?.expiringSoonContracts),
    expiredContracts: n(raw?.expiredContracts),
    cancelledContracts: n(raw?.cancelledContracts),
  };
}

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly api = inject(ApiService);

  /** One server page, newest first (server-ordered) — callers must not re-sort. */
  list(query: ContractListQuery, force = false): Observable<PagedResult<ContractListItem>> {
    const cache = withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT }));
    return this.api
      .get<PagedResult<ContractListItem>>(API_ENDPOINTS.contracts.list, {
        params: toListParams(query),
        context: force ? withCacheBypass(cache) : cache,
      })
      .pipe(
        map((page) => ({
          pageIndex: page?.pageIndex ?? query.pageIndex,
          pageSize: page?.pageSize ?? query.pageSize,
          count: page?.count ?? 0,
          data: (page?.data ?? []).map(normalizeContractRow),
        })),
      );
  }

  /**
   * Every row matching `filters`, walked page by page at the server cap
   * (100). Only for explicit "export all" actions — screens use `list()`.
   */
  listAllMatching(filters: Omit<ContractListQuery, 'pageIndex' | 'pageSize'>): Observable<ContractListItem[]> {
    const pageSize = CONTRACTS_MAX_PAGE_SIZE;
    const fetch = (pageIndex: number) => this.list({ ...filters, pageIndex, pageSize });
    return fetch(1).pipe(
      expand((page) =>
        page.data.length === pageSize && page.pageIndex * pageSize < page.count
          ? fetch(page.pageIndex + 1)
          : EMPTY,
      ),
      reduce((rows, page) => rows.concat(page.data), [] as ContractListItem[]),
    );
  }

  getById(id: number): Observable<ContractDetail> {
    return this.api
      .get<ContractDetail>(API_ENDPOINTS.contracts.byId(id), {
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
      })
      .pipe(map((c) => ({ ...c, status: parseContractStatus(c?.status ?? c?.statusName) ?? 'Active' })));
  }

  /** KPI + tab numbers, already scoped to the caller by the server. */
  statistics(force = false): Observable<ContractStatistics> {
    const cache = withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT }));
    return this.api
      .get<Partial<ContractStatistics> | null>(API_ENDPOINTS.contracts.statistics, {
        context: force ? withCacheBypass(cache) : cache,
      })
      .pipe(map(normalizeStatistics));
  }

  /**
   * Same numbers as `ContractStatistics`, for one sales rep. The statistics
   * endpoint has no sales-rep filter, so each figure is the `count` of the
   * matching `GetContracts` query (`pageSize=1`) — i.e. exactly what each
   * tab lists for that rep.
   */
  statisticsForSalesPerson(salesPersonId: string, force = false): Observable<ContractStatistics> {
    const count = (filter: Partial<ContractListQuery>) =>
      this.list({ pageIndex: 1, pageSize: 1, salesPersonId, ...filter }, force).pipe(map((p) => p.count));
    return forkJoin({
      totalContracts: count({}),
      activeContracts: count({ status: 'Active' }),
      expiringSoonContracts: count({ expiringSoon: true }),
      expiredContracts: count({ status: 'Expired' }),
      cancelledContracts: count({ status: 'Cancelled' }),
    });
  }

  /** Sales reps for the Admin's "created by" filter. */
  salesTeam(): Observable<SalesPerson[]> {
    return this.api
      .get<SalesPerson[]>(API_ENDPOINTS.auth.sales, {
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.LONG })),
      })
      .pipe(map((rows) => (Array.isArray(rows) ? rows : [])));
  }

  create(payload: CreateContractRequest): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.contracts.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Contracts', 'AdminDashboard'])) },
    );
  }

  update(id: number, payload: UpdateContractRequest): Observable<unknown> {
    return this.api.put<unknown>(
      API_ENDPOINTS.contracts.update(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Contracts', 'AdminDashboard'])) },
    );
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.contracts.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Contracts', 'AdminDashboard'])),
    });
  }

  /** Customer picker (id + company) — same source the quotation form uses. */
  customersDropdown(): Observable<CustomerDropdownItem[]> {
    return this.api.get<CustomerDropdownItem[]>(
      API_ENDPOINTS.customers.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }
}
