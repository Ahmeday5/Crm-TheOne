import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache, withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { CustomerDropdownItem } from '../../../shared/models';
import { ServicesService } from '../../services/services/services.service';
import { PlaybookServiceRef } from '../models/sales-playbook.models';

/**
 * Reference data the playbook links to: services (scripts) and customers
 * (competitor mentions). Both are read-only, cached by the HTTP layer and
 * shared between subscribers for the lifetime of the app.
 */
@Injectable({ providedIn: 'root' })
export class PlaybookLookupsService {
  private readonly api = inject(ApiService);
  private readonly servicesApi = inject(ServicesService);

  private services$?: Observable<PlaybookServiceRef[]>;
  private customers$?: Observable<CustomerDropdownItem[]>;

  services(): Observable<PlaybookServiceRef[]> {
    return (this.services$ ??= this.servicesApi.list({ pageSize: 100 }).pipe(
      map((page) =>
        (page?.data ?? []).map(({ id, nameAr, nameEn }) => ({ id, nameAr: nameAr ?? '', nameEn: nameEn ?? '' })),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    ));
  }

  customers(): Observable<CustomerDropdownItem[]> {
    return (this.customers$ ??= this.api
      .get<CustomerDropdownItem[] | null>(API_ENDPOINTS.customers.dropdown, {
        context: withSkipLoader(withInlineHandling(withCache({ ttlMs: CACHE_TTL.LONG }))),
      })
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : [])),
        shareReplay({ bufferSize: 1, refCount: false }),
      ));
  }

  /** Forget a failed lookup so the next call retries. */
  reset(): void {
    this.services$ = undefined;
    this.customers$ = undefined;
  }
}
