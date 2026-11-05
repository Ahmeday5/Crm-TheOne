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
  ContractDetail,
  ContractListItem,
  ContractListQuery,
  ContractStatistics,
  CreateContractRequest,
  CustomerDropdownItem,
  PagedResult,
  UpdateContractRequest,
  parseContractStatus,
} from '../../../shared/models';

/**
 * HTTP boundary for `Contracts/*` plus the customer picker used by the
 * add-contract dialog.
 *
 * The list endpoint returns the generic `{ pageIndex, pageSize, count, data }`
 * envelope but has no status filter, so the management page loads the whole
 * set once (`listAll`) and filters / counts / paginates it client-side —
 * otherwise tab counts would only reflect the current page.
 *
 * `status` arrives as a string enum ("Active" | "Expired" | "Cancelled");
 * rows are normalised through `parseContractStatus` so the UI never sees an
 * unexpected shape.
 *
 * `create()` invalidates every cached `Contracts` URL so the list refetches.
 */
/**
 * Field names the list DTO has used for the contract amount. The row's
 * value rendered as 0 for every contract because the list payload did not
 * carry it as `price`; reading the first numeric alias keeps the UI correct
 * whichever name the server serializes.
 */
const PRICE_KEYS = ['price', 'totalPrice', 'contractPrice', 'contractValue', 'value', 'amount', 'totalAmount'] as const;

/** Page size for the "load everything" request; refetched with `count` if exceeded. */
const ALL_PAGE_SIZE = 1000;

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

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly api = inject(ApiService);

  /** Newest first (server-ordered) — callers must not re-sort. */
  list(query: ContractListQuery = {}, force = false): Observable<PagedResult<ContractListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api
      .get<PagedResult<ContractListItem>>(API_ENDPOINTS.contracts.list, {
        params: query as Record<string, unknown>,
        context: ctx,
      })
      .pipe(map((page) => ({ ...page, data: (page?.data ?? []).map(normalizeContractRow) })));
  }

  /** Every contract (newest first) — for client-side filtering and counts. */
  listAll(force = false): Observable<ContractListItem[]> {
    return this.list({ PageIndex: 1, PageSize: ALL_PAGE_SIZE }, force).pipe(
      switchMap((page) =>
        (page.count ?? 0) > page.data.length
          ? this.list({ PageIndex: 1, PageSize: page.count }, force).pipe(map((all) => all.data))
          : of(page.data),
      ),
    );
  }

  getById(id: number): Observable<ContractDetail> {
    return this.api
      .get<ContractDetail>(API_ENDPOINTS.contracts.byId(id), {
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
      })
      .pipe(map((c) => ({ ...c, status: parseContractStatus(c?.status ?? c?.statusName) ?? 'Active' })));
  }

  statistics(): Observable<ContractStatistics> {
    return this.api.get<ContractStatistics>(
      API_ENDPOINTS.contracts.statistics,
      { context: withCache({ ttlMs: CACHE_TTL.SHORT }) },
    );
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
