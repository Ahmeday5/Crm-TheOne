import { Observable, firstValueFrom } from 'rxjs';
import { CustomerListItem, PagedResult, SalesPerson } from '../../../shared/models';

/**
 * Sales-rep filter for the customer lists — done on the FRONTEND until the
 * backend accepts a `SalesPersonId` query param.
 *
 * Why not just filter the visible page: the lists are paged server-side, so
 * filtering 10 rows would hide matches on other pages and show wrong counts.
 * Instead, while a rep is selected, every page matching the other (server-side)
 * filters is collected once, filtered here, and paged locally. Changing page
 * reuses that set; any other change refetches it.
 *
 * TODO(backend): when `getLeadCustomer` / `getSalesCustomers` take
 * `SalesPersonId`, send it in the list query and drop this file.
 */

/** Select value for "customers with no sales rep yet". */
export const UNASSIGNED_SALES = '__unassigned__';

/** Upper bound on pages fetched (safety net against a misbehaving `count`). */
const MAX_PAGES = 200;
const CHUNK = 500;

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Does `row` belong to the selected rep? Matches on `salesPersonId` when the
 * row carries it; otherwise on the rep's full name (the marketing list only
 * returns `salesPersonName`).
 */
export function matchesSalesPerson(row: CustomerListItem, selected: string, team: ReadonlyArray<SalesPerson>): boolean {
  const rowId = row.salesPersonId ?? null;
  const rowName = norm(row.salesPersonName);
  if (selected === UNASSIGNED_SALES) return !rowId && !rowName;
  if (rowId) return rowId === selected;
  const person = team.find((p) => p.userId === selected);
  return !!person && !!rowName && rowName === norm(person.fullName);
}

/**
 * Collects every page of a list query. Works whatever page size the server
 * actually honours (it may cap `PageSize`): pages are requested with the same
 * size until `count` rows are in or a page comes back empty. Rows are
 * de-duplicated by id in case data shifts between pages.
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

/** Slice for the current page (1-based). */
export function pageSlice<T>(rows: ReadonlyArray<T>, pageIndex: number, pageSize: number): T[] {
  const start = (pageIndex - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** Last valid page for `count` rows (≥ 1). */
export function lastPage(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, pageSize)));
}
