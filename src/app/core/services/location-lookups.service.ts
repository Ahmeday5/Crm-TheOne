import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { CACHE_TTL } from '../constants/cache-policy.const';
import { withCache, withSkipLoader } from '../http/http-context.tokens';
import { Country, Governorate } from '../../shared/models/locations/location.model';
import { ApiService } from './api.service';

/** Sort Arabic names the way a reader expects (ا → ي). */
const byArabicName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ar');

/**
 * Countries + Egyptian governorates — reference data that never changes at
 * runtime. Each list is requested once per session (shared, replayed) and
 * also kept in the HTTP cache for a day, so forms, filters and the customer
 * map all read the same instance. A failed load is not cached: the next
 * subscriber tries again.
 */
@Injectable({ providedIn: 'root' })
export class LocationLookupsService {
  private readonly api = inject(ApiService);

  private countries$?: Observable<Country[]>;
  private governorates$?: Observable<Governorate[]>;

  countries(): Observable<Country[]> {
    return (this.countries$ ??= this.load<Country>(API_ENDPOINTS.campaigns.dropdownCountries, () => {
      this.countries$ = undefined;
    }));
  }

  governorates(): Observable<Governorate[]> {
    return (this.governorates$ ??= this.load<Governorate>(API_ENDPOINTS.customers.governorates, () => {
      this.governorates$ = undefined;
    }));
  }

  private load<T extends { name: string }>(endpoint: string, reset: () => void): Observable<T[]> {
    return this.api
      .get<T[] | null>(endpoint, { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.DAY })) })
      .pipe(
        map((rows) => (Array.isArray(rows) ? [...rows].sort(byArabicName) : [])),
        catchError((err) => {
          reset();
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
  }
}
