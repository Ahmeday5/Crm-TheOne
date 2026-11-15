import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { withSilentErrors, withSkipAuth, withSkipLoader } from '../../../core/http/http-context.tokens';
import { MapLevel } from '../models/geo.models';

/** GeoJSON feature collection (`properties.name` is the join key). */
export interface GeoJson {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { name: string; [key: string]: unknown }; geometry: unknown }[];
}

/** Bundled boundaries (see `src/assets/geo/ATTRIBUTION.md`). */
const GEO_ASSETS: Record<MapLevel, string> = {
  world: 'assets/geo/world.geo.json',
  egypt: 'assets/geo/egypt.geo.json',
};

/**
 * Country / governorate shapes, fetched once per session. A failure resolves
 * to `null` (the map then shows bubbles at the API's lat / lng) and is retried
 * on the next request.
 */
@Injectable({ providedIn: 'root' })
export class GeoBoundariesService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<MapLevel, Observable<GeoJson | null>>();

  boundaries(level: MapLevel): Observable<GeoJson | null> {
    let geo$ = this.cache.get(level);
    if (!geo$) {
      geo$ = this.http
        .get<GeoJson>(GEO_ASSETS[level], { context: withSilentErrors(withSkipLoader(withSkipAuth())) })
        .pipe(
          map((json) => (json?.type === 'FeatureCollection' && Array.isArray(json.features) ? json : null)),
          catchError(() => {
            this.cache.delete(level);
            return of(null);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.cache.set(level, geo$);
    }
    return geo$;
  }
}
