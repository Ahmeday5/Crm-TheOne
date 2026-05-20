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
  AssignSupportRequest,
  ChangeCustomerStatusRequest,
  CreateCustomerRequest,
  CustomerDetails,
  CustomerFollowUpResponse,
  CustomerListItem,
  CustomerListQuery,
  CustomerNoteResponse,
  CustomerStatus,
  PagedResult,
  SalesPerson,
  SaveCustomerNoteRequest,
  SupportPerson,
  UpdateCustomerRequest,
  UpdateFollowUpRequest,
} from '../../../shared/models';
import { CampaignDropdownItem } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly api = inject(ApiService);

  // ─────────── reads ───────────

  list(
    query: CustomerListQuery = {},
  ): Observable<PagedResult<CustomerListItem>> {
    return this.api.get<PagedResult<CustomerListItem>>(
      API_ENDPOINTS.customers.list,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  listForSales(
    query: CustomerListQuery = {},
  ): Observable<PagedResult<CustomerListItem>> {
    return this.api.get<PagedResult<CustomerListItem>>(
      API_ENDPOINTS.customers.salesCustomers,
      {
        params: query as Record<string, unknown>,
        context: withCache({ ttlMs: CACHE_TTL.SHORT }),
      },
    );
  }

  listForSupport(
    query: CustomerListQuery = {},
  ): Observable<PagedResult<CustomerListItem>> {
    return this.api.get<PagedResult<CustomerListItem>>(
      API_ENDPOINTS.customers.supportCustomers,
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

  supportTeam(): Observable<SupportPerson[]> {
    return this.api.get<SupportPerson[]>(API_ENDPOINTS.auth.support, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  campaignsDropdown(): Observable<CampaignDropdownItem[]> {
    return this.api.get<CampaignDropdownItem[]>(
      API_ENDPOINTS.campaigns.dropdown,
      {
        context: withCache({ ttlMs: CACHE_TTL.LONG }),
      },
    );
  }

  // ─────────── mutations ───────────

  create(
    payload: CreateCustomerRequest,
  ): Observable<{ id: number; fullName: string }> {
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

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.customers.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Customers'])),
    });
  }

  assign(
    customerId: number,
    payload: AssignCustomerRequest,
  ): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.customers.assign(customerId),
      payload,
      {
        context: withInlineHandling(withCacheInvalidate(['Customers'])),
      },
    );
  }

  assignSupport(
    customerId: number,
    payload: AssignSupportRequest,
  ): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.customers.assignSupport(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Customers'])) },
    );
  }

  changeStatus(
    customerId: number,
    payload: ChangeCustomerStatusRequest,
  ): Observable<CustomerFollowUpResponse> {
    return this.api.put<CustomerFollowUpResponse>(
      API_ENDPOINTS.customers.changeStatus(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Customers'])) },
    );
  }

  updateFollowUp(
    customerId: number,
    payload: UpdateFollowUpRequest,
  ): Observable<CustomerFollowUpResponse> {
    return this.api.put<CustomerFollowUpResponse>(
      API_ENDPOINTS.customers.followUp(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Customers'])) },
    );
  }

  /**
   * Upserts the caller's role-specific note for `customerId`.
   *
   * The backend identifies the slot (Marketing/Sales/Support) from the JWT
   * role, so the payload is just `{ note }` — never role-keyed.
   *
   * Errors flow back as `ApiError` — typically `400` with
   * "You are not the current assignee for this customer." when the user
   * isn't the active owner.
   */
  saveMyNote(
    customerId: number,
    value: string,
  ): Observable<CustomerNoteResponse> {
    const payload: SaveCustomerNoteRequest = { note: value.trim() };
    return this.api.put<CustomerNoteResponse>(
      API_ENDPOINTS.customerNotes.myNote(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['Customers'])) },
    );
  }
}
