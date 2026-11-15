import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache, withCacheBypass, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { GeoAggregate, normalizeGeoAggregate, toMapParams } from '../../geo-insights';
import { CustomerMapQuery } from '../models/customer-map.models';

/** `GET /Customers/map` — customers per country / Egyptian governorate (Sales: own customers). */
@Injectable({ providedIn: 'root' })
export class CustomerMapService {
  private readonly api = inject(ApiService);

  load(query: CustomerMapQuery, force = false): Observable<GeoAggregate> {
    const cache = withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT }));
    return this.api
      .get<Partial<GeoAggregate> | null>(API_ENDPOINTS.customers.map, {
        params: toMapParams(query),
        context: force ? withCacheBypass(cache) : cache,
      })
      .pipe(map(normalizeGeoAggregate));
  }
}
