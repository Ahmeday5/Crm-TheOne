import { Observable, firstValueFrom } from 'rxjs';
import { CUSTOMER_LIST_MAX_PAGE_SIZE, CustomerListItem, PagedResult } from '../../../shared/models';

/** Upper bound on pages fetched (safety net against a misbehaving `count`). */
const MAX_PAGES = 200;
/** The server caps customer pages at 50 rows — ask for exactly that. */
const CHUNK = CUSTOMER_LIST_MAX_PAGE_SIZE;

/**
 * Collects every page of a customer list query (exports, stats that need the
 * whole set). Works whatever page size the server actually honours: pages are
 * requested with the same size until `count` rows are in or a page comes back
 * empty. Rows are de-duplicated by id in case data shifts between pages.
 */
export async function fetchAllPages(
  fetchPage: (pageIndex: number, pageSize: number) => Observable<PagedResult<CustomerListItem>>,
): Promise<CustomerListItem[]> {
  const seen = new Set<number>();
  const all: CustomerListItem[] = [];
  let total = Infinity;
  for (let page = 1; page <= MAX_PAGES && all.length < total; page++) {
    const res = await firstValueFrom(fetchPage(page, CHUNK));
    const data = res?.data ?? [];
    total = res?.count ?? data.length;
    if (!data.length) break;
    for (const row of data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      all.push(row);
    }
  }
  return all;
}
