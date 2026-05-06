/**
 * Standard paged-list shape returned by paginated GET endpoints
 * (e.g. `GET /api/Services`):
 *
 *   { pageIndex, pageSize, count, data: T[] }
 *
 * `count` is the total number of records across all pages, not the page
 * length. The grid + paginator components rely on that contract.
 */
export interface PagedResult<T> {
  pageIndex: number;
  pageSize: number;
  count: number;
  data: T[];
}

/** Common query shape for paginated + searchable list endpoints. */
export interface PagedQuery {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
}
