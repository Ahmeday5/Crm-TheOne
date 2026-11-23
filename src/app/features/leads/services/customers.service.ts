import { Injectable, inject } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
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
import { toDateRangeParams } from '../../../core/utils/date-range.util';
import {
  AssignCustomerRequest,
  AssignSupportRequest,
  AssignSupportResponse,
  ChangeCustomerStatusRequest,
  CUSTOMER_LIST_MAX_PAGE_SIZE,
  CreateCustomerRequest,
  CustomerDateFilter,
  CustomerDetails,
  CustomerDropdownItem,
  CustomerFollowUpResponse,
  CustomerListItem,
  CustomerListQuery,
  CustomerNoteResponse,
  CustomerStatus,
  CustomerStatusChange,
  LogContactAttemptRequest,
  PagedResult,
  SalesPerson,
  SaveCustomerNoteRequest,
  SupportCustomerStats,
  SupportPerson,
  UpdateCustomerRequest,
  UpdateFollowUpRequest,
} from '../../../shared/models';
import { CampaignDropdownItem } from '../../../shared/models';

/**
 * URL patterns dropped after any customer mutation. A new/assigned/converted
 * customer moves the figures the marketing, sales, and admin dashboards
 * aggregate (lead counts, conversion, buyers/non-buyers) — so those caches
 * are invalidated alongside the `Customers` lists, otherwise the dashboards
 * keep serving stale counts until their own TTL lapses.
 */
const CUSTOMER_CACHE_KEYS = [
  'Customers',
  'Marketing',
  'Sales',
  'Support',
  'Campaigns',
  'AdminDashboard',
] as const;

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly api = inject(ApiService);
  private readonly statusChanges = new Subject<CustomerStatusChange>();

  /**
   * Every successfully saved status change, whichever screen made it. Emits
   * after the server confirmed — never optimistically.
   */
  readonly statusChanged$: Observable<CustomerStatusChange> = this.statusChanges.asObservable();

  // ─────────── reads ───────────

  /** Leads — `GET Customers/getLeadCustomer` (Admin, Marketing). */
  list(
    query: CustomerListQuery = {},
    force = false,
  ): Observable<PagedResult<CustomerListItem>> {
    return this.page(API_ENDPOINTS.customers.list, query, force);
  }

  /** Sales customers — `GET Customers/getSalesCustomers` (Admin, Sales). */
  listForSales(
    query: CustomerListQuery = {},
    force = false,
  ): Observable<PagedResult<CustomerListItem>> {
    return this.page(API_ENDPOINTS.customers.salesCustomers, query, force);
  }

  /** Support customers — `GET Customers/getSupportCustomers` (Admin, Support). */
  listForSupport(
    query: CustomerListQuery = {},
    force = false,
  ): Observable<PagedResult<CustomerListItem>> {
    return this.page(API_ENDPOINTS.customers.supportCustomers, query, force);
  }

  /**
   * Buyers only — `GET Customers/buyers` (Admin: all; Sales / Support: their
   * own). Every row is a Buyer, so `CustomerStatusId` is stripped here
   * rather than trusting every caller to leave it out.
   */
  buyers(
    query: CustomerListQuery = {},
    force = false,
  ): Observable<PagedResult<CustomerListItem>> {
    const { CustomerStatusId: _ignored, ...rest } = query;
    return this.page(API_ENDPOINTS.customers.buyers, rest, force);
  }

  /** Quick lookup by phone or name — `GET Customers/search` (not paged). */
  search(term: string, dates: CustomerDateFilter = {}): Observable<CustomerListItem[]> {
    return this.api.get<CustomerListItem[]>(API_ENDPOINTS.customers.search, {
      params: { SearchPhoneOrName: term.trim(), ...toDateRangeParams(dates) },
      context: withInlineHandling(),
    });
  }

  /** Lightweight picker — `GET Customers/dropdownCustomers`, optionally by date added. */
  dropdown(dates: CustomerDateFilter = {}): Observable<CustomerDropdownItem[]> {
    return this.api.get<CustomerDropdownItem[]>(API_ENDPOINTS.customers.dropdown, {
      params: toDateRangeParams(dates),
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  /**
   * Shared GET for the paged lists. `PageSize` is clamped to the server cap
   * so a caller asking for "everything" gets full pages instead of a 400.
   */
  private page(
    endpoint: string,
    query: CustomerListQuery,
    force: boolean,
  ): Observable<PagedResult<CustomerListItem>> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    const params: CustomerListQuery = {
      ...query,
      PageSize:
        query.PageSize === undefined
          ? undefined
          : Math.min(Math.max(1, query.PageSize), CUSTOMER_LIST_MAX_PAGE_SIZE),
    };
    return this.api.get<PagedResult<CustomerListItem>>(endpoint, {
      params: params as Record<string, unknown>,
      context: ctx,
    });
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

  supportStats(force = false): Observable<SupportCustomerStats> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT }));
    return this.api.get<SupportCustomerStats>(
      API_ENDPOINTS.support.customerStats,
      { context: ctx },
    );
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
      { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
    );
  }

  update(id: number, payload: UpdateCustomerRequest): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.customers.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)),
    });
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.customers.delete(id), {
      context: withSkipLoader(withCacheInvalidate(CUSTOMER_CACHE_KEYS)),
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
        context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)),
      },
    );
  }

  /**
   * Support finishes the consultation and returns the customer to their
   * original sales rep — `POST /Support/{id}/ReturnToSalesPerson`. The rep is
   * resolved server-side from the customer record, so there's no body. The
   * backend flips `isConsulted` to `true` and echoes the updated customer, so
   * we invalidate the cached `Customers` lists to surface it on the next read.
   */
  returnToSalesPerson(customerId: number): Observable<CustomerListItem> {
    return this.api.post<CustomerListItem>(
      API_ENDPOINTS.support.returnToSalesPerson(customerId),
      {},
      { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
    );
  }

  /**
   * Hands a lead to a support person and books the follow-up appointment in
   * one call. Resolves to `{ customer, appointment }` (the envelope's
   * `data`). Invalidates appointment caches too, so open/cached schedule
   * views pick up the new appointment.
   */
  assignSupport(
    customerId: number,
    payload: AssignSupportRequest,
  ): Observable<AssignSupportResponse> {
    return this.api.post<AssignSupportResponse>(
      API_ENDPOINTS.customers.assignSupport(customerId),
      payload,
      {
        context: withInlineHandling(
          withCacheInvalidate([...CUSTOMER_CACHE_KEYS, 'Appointments']),
        ),
      },
    );
  }

  changeStatus(
    customerId: number,
    payload: ChangeCustomerStatusRequest,
  ): Observable<CustomerFollowUpResponse> {
    return this.api
      .put<CustomerFollowUpResponse>(
        API_ENDPOINTS.customers.changeStatus(customerId),
        payload,
        { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
      )
      .pipe(
        tap((customer) =>
          this.statusChanges.next({ customerId, status: payload.status, customer }),
        ),
      );
  }

  updateFollowUp(
    customerId: number,
    payload: UpdateFollowUpRequest,
  ): Observable<CustomerFollowUpResponse> {
    return this.api.put<CustomerFollowUpResponse>(
      API_ENDPOINTS.customers.followUp(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
    );
  }

  /**
   * Records a contact attempt (call result + optional notes) for a customer.
   * The backend logs this as a `CustomerActivity` of type `ContactAttempted`,
   * which is what the sales-person call-count spec reads — so counts stay
   * accurate regardless of the customer's current status.
   *
   * Returns the same lightweight projection as `changeStatus` — callers can
   * patch `lastFollowUpDate` in-place from the response without a full reload.
   */
  logContactAttempt(
    customerId: number,
    payload: LogContactAttemptRequest,
  ): Observable<CustomerFollowUpResponse> {
    return this.api.post<CustomerFollowUpResponse>(
      API_ENDPOINTS.customers.contact(customerId),
      payload,
      { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
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
      { context: withInlineHandling(withCacheInvalidate(CUSTOMER_CACHE_KEYS)) },
    );
  }
}
