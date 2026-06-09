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
  CustomerDropdownItem,
  PriceQuotationDetail,
  PriceQuotationListQuery,
  PriceQuotationPage,
  PriceQuotationRequest,
} from '../../../shared/models';

/**
 * HTTP boundary for `PriceQuotations/*` plus the customer picker that feeds
 * the quotation form.
 *
 * Caching mirrors the campaigns service: reads are cached and every mutation
 * invalidates any cached URL containing `PriceQuotations`, so the list and
 * the contract refetch automatically after a create/update/delete. The
 * customer dropdown is cached long — it changes rarely and is reused by
 * every quotation form open.
 */
@Injectable({ providedIn: 'root' })
export class PriceQuotationsService {
  private readonly api = inject(ApiService);

  list(
    query: PriceQuotationListQuery = {},
    force = false,
  ): Observable<PriceQuotationPage> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.SHORT }))
      : withCache({ ttlMs: CACHE_TTL.SHORT });
    return this.api.get<PriceQuotationPage>(API_ENDPOINTS.priceQuotations.list, {
      params: query as Record<string, unknown>,
      context: ctx,
    });
  }

  getById(id: number): Observable<PriceQuotationDetail> {
    return this.api.get<PriceQuotationDetail>(
      API_ENDPOINTS.priceQuotations.byId(id),
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }

  /** Customers with their services — drives the form's customer picker. */
  customersDropdown(): Observable<CustomerDropdownItem[]> {
    return this.api.get<CustomerDropdownItem[]>(
      API_ENDPOINTS.customers.dropdown,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  create(payload: PriceQuotationRequest): Observable<PriceQuotationDetail> {
    return this.api.post<PriceQuotationDetail>(
      API_ENDPOINTS.priceQuotations.add,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['PriceQuotations'])) },
    );
  }

  update(
    id: number,
    payload: PriceQuotationRequest,
  ): Observable<PriceQuotationDetail> {
    return this.api.put<PriceQuotationDetail>(
      API_ENDPOINTS.priceQuotations.update(id),
      payload,
      { context: withInlineHandling(withCacheInvalidate(['PriceQuotations'])) },
    );
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.priceQuotations.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['PriceQuotations'])),
    });
  }
}
