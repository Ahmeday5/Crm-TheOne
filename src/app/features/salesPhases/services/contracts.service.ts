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
  ContractDetail,
  ContractListItem,
  ContractListQuery,
  ContractStatistics,
  CreateContractRequest,
  CustomerDropdownItem,
  PagedResult,
  UpdateContractRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for `Contracts/*` plus the customer picker used by the
 * add-contract dialog.
 *
 * The list endpoint returns the generic `{ pageIndex, pageSize, count, data }`
 * envelope. Search by customer / company / phone is applied client-side on
 * the loaded page — the backend exposes no search query for this endpoint.
 *
 * `create()` invalidates every cached `Contracts` URL so the list refetches.
 */
@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly api = inject(ApiService);

  list(query: ContractListQuery = {}, force = false): Observable<PagedResult<ContractListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PagedResult<ContractListItem>>(
      API_ENDPOINTS.contracts.list,
      { params: query as Record<string, unknown>, context: ctx },
    );
  }

  getById(id: number): Observable<ContractDetail> {
    return this.api.get<ContractDetail>(API_ENDPOINTS.contracts.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
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
