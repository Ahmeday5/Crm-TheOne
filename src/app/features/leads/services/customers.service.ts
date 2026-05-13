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
  AssignCustomerRequest,
  CreateCustomerRequest,
  CustomerDetails,
  CustomerListItem,
  CustomerListQuery,
  CustomerStatus,
  PagedResult,
  SalesPerson,
  UpdateCustomerRequest,
} from '../../../shared/models';
import { CampaignDropdownItem } from '../../../shared/models';

/**
 * HTTP boundary for the `Customers/*` endpoints.
 *
 * Caching:
 *   - `list()` uses SHORT TTL (1 min) because leads change frequently.
 *   - `statuses()` and `salesTeam()` use LONG TTL — they're reference data.
 *   - Mutations invalidate every cached URL containing `Customers` so the
 *     next list/detail read refetches automatically.
 *
 * Loaders / errors:
 *   - Mutations use `withInlineHandling()` so the dialog/button owns the
 *     spinner; validation errors surface inside the dialog.
 *   - `getById()` skips the global loader (the dialog has its own spinner).
 */
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly api = inject(ApiService);

  // ─────────── reads ───────────

  list(query: CustomerListQuery = {}): Observable<PagedResult<CustomerListItem>> {
    return this.api.get<PagedResult<CustomerListItem>>(API_ENDPOINTS.customers.list, {
      params: query as Record<string, unknown>,
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  /**
   * Sales-scoped customers. Same query/page envelope as `list()`, but the
   * server applies a per-role filter:
   *   - Sales: only customers assigned to the caller
   *   - Admin: every assigned customer across the team
   *
   * Caching is keyed on the request URL, so admin vs sales results never
   * stomp on each other.
   */
  listForSales(query: CustomerListQuery = {}): Observable<PagedResult<CustomerListItem>> {
    return this.api.get<PagedResult<CustomerListItem>>(
      API_ENDPOINTS.customers.salesCustomers,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  getById(id: number): Observable<CustomerDetails> {
    return this.api.get<CustomerDetails>(API_ENDPOINTS.customers.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  statuses(): Observable<CustomerStatus[]> {
    return this.api.get<CustomerStatus[]>(API_ENDPOINTS.customers.statuses, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  salesTeam(): Observable<SalesPerson[]> {
    return this.api.get<SalesPerson[]>(API_ENDPOINTS.auth.sales, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  campaignsDropdown(): Observable<CampaignDropdownItem[]> {
    return this.api.get<CampaignDropdownItem[]>(API_ENDPOINTS.campaigns.dropdown, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  // ─────────── mutations ───────────

  create(payload: CreateCustomerRequest): Observable<{ id: number; fullName: string }> {
    return this.api.post<{ id: number; fullName: string }>(
      API_ENDPOINTS.customers.create,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Customers'])) },
    );
  }

  update(id: number, payload: UpdateCustomerRequest): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.customers.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Customers'])),
    });
  }

  /**
   * Hard delete. FK-conflict 409s flow to the global toast because the page
   * has no inline error slot for delete; we only skip the global loader so
   * the row spinner is the single in-flight indicator.
   */
  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.customers.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Customers'])),
    });
  }

  assign(customerId: number, payload: AssignCustomerRequest): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.customers.assign(customerId), payload, {
      context: withInlineHandling(withCacheInvalidate(['Customers'])),
    });
  }
}
