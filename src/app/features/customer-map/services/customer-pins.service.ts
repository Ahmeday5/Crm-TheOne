import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { GeoGovernorate, GeoPointInput } from '../../geo-insights';
import { CustomerListItem } from '../../../shared/models';
import { CustomersService } from '../../leads/services/customers.service';
import { CustomerMapQuery } from '../models/customer-map.models';

/** Egypt's id — pins are an Egypt-only feature (the only level with governorates). */
const EGYPT_COUNTRY_ID = 20;
/** Page size for the bulk pin fetch — large so most scopes load in one round-trip. */
const PIN_PAGE_SIZE = 200;
/** Safety cap: never pull more than this many customers for pins at once. */
const MAX_PINS = 5000;

/** Resolve a customer's display name (falls back to phone). */
function labelOf(c: CustomerListItem): string {
  return (c.fullName || '').trim() || c.phone || `#${c.id}`;
}

/**
 * Loads **every** customer in a map scope (one governorate, or all of Egypt)
 * and projects each onto its governorate centroid so the explorer can scatter
 * them into individual pins.
 *
 * The list endpoint (`getSalesCustomers`) is paged; this service walks the
 * pages until the scope is exhausted or {@link MAX_PINS} is reached, so a
 * governorate with 1000 customers yields 1000 pins without the caller paging.
 *
 * Customers carry only a `governorateId`, never their own coordinates, so a
 * pin's base position is its governorate's centre; the explorer's scatter adds
 * the per-customer offset.
 */
@Injectable({ providedIn: 'root' })
export class CustomerPinsService {
  private readonly customers = inject(CustomersService);

  /**
   * @param governorateId  one governorate, or `null` for all of Egypt
   * @param centroids      governorate id → centroid (from the aggregate)
   * @param filters        the map's active status / source filters
   */
  load(
    governorateId: number | null,
    centroids: ReadonlyMap<number, Pick<GeoGovernorate, 'lat' | 'lng' | 'name' | 'nameEn'>>,
    filters: CustomerMapQuery = {},
  ): Observable<GeoPointInput[]> {
    return this.fetchAll(governorateId, filters).pipe(
      map((rows) => this.toPoints(rows, centroids)),
    );
  }

  /** Walk every page of the scope (bounded by {@link MAX_PINS}). */
  private fetchAll(governorateId: number | null, filters: CustomerMapQuery): Observable<CustomerListItem[]> {
    const fetchPage = (pageIndex: number) =>
      this.customers
        .listForSales({
          PageIndex: pageIndex,
          PageSize: PIN_PAGE_SIZE,
          CountryId: EGYPT_COUNTRY_ID,
          GovernorateId: governorateId ?? undefined,
          CustomerStatusId: filters.customerStatusId ?? undefined,
          SourceId: filters.sourceId ?? undefined,
        })
        .pipe(map((page) => ({ rows: page.data ?? [], total: page.count ?? 0, pageIndex })));

    return fetchPage(1).pipe(
      expand((res) => {
        const loaded = res.pageIndex * PIN_PAGE_SIZE;
        const more = loaded < res.total && loaded < MAX_PINS && res.rows.length > 0;
        return more ? fetchPage(res.pageIndex + 1) : EMPTY;
      }),
      reduce((acc, res) => acc.concat(res.rows), [] as CustomerListItem[]),
      map((rows) => rows.slice(0, MAX_PINS)),
    );
  }

  /** Keep only customers whose governorate we can place, and map to pin inputs. */
  private toPoints(
    rows: CustomerListItem[],
    centroids: ReadonlyMap<number, Pick<GeoGovernorate, 'lat' | 'lng' | 'name' | 'nameEn'>>,
  ): GeoPointInput[] {
    const points: GeoPointInput[] = [];
    for (const c of rows) {
      const gid = c.governorateId ?? undefined;
      if (gid == null) continue;
      const centroid = centroids.get(gid);
      if (!centroid || !Number.isFinite(centroid.lat) || !Number.isFinite(centroid.lng)) continue;
      points.push({
        id: c.id,
        label: labelOf(c),
        sub: c.governorateName ?? centroid.name,
        lat: centroid.lat,
        lng: centroid.lng,
      });
    }
    return points;
  }
}
