/**
 * Models for the `PriceQuotations/*` endpoints.
 *
 * Naming note: the backend serializes the company field as `campanyName`
 * (a server-side typo). We mirror it verbatim so the JSON maps 1:1 — never
 * "fix" it on the client or the binding silently breaks.
 */

/** A service offered to a customer — used inside the customer picker. */
export interface CustomerDropdownService {
  id: number;
  name: string;
}

/**
 * Item returned by `GET /Customers/dropdownCustomers`.
 *
 * Selecting one of these in the quotation form seeds the line-items grid:
 * every `services[]` entry becomes an editable row (unit price + quantity).
 */
export interface CustomerDropdownItem {
  id: number;
  fullName: string;
  campanyName: string | null;
  services: CustomerDropdownService[];
}

/** One line item in the create/update request body. */
export interface PriceQuotationItemRequest {
  serviceId: number;
  unitPrice: number;
  quantity: number;
}

/** Body for `POST /PriceQuotations` and `PUT /PriceQuotations/{id}`. */
export interface PriceQuotationRequest {
  customerId: number;
  discount: number;
  notes: string;
  items: PriceQuotationItemRequest[];
}

/** A persisted line item (create / update / detail responses). */
export interface PriceQuotationItem {
  id: number;
  serviceId: number;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

/** Row shape returned by `GET /PriceQuotations` (paged list projection). */
export interface PriceQuotationListItem {
  id: number;
  customerId: number;
  customerName: string;
  campanyName: string | null;
  subTotal: number;
  discount: number;
  netTotal: number;
  itemsCount: number;
  notes: string | null;
}

/**
 * Full detail returned by `GET /PriceQuotations/{id}` and the create/update
 * responses.
 *
 * `createdAt` is optional: the backend does not return it yet but has been
 * asked to add it. The contract document falls back to "today" until it
 * starts arriving, so wiring it now is a no-op when absent.
 */
export interface PriceQuotationDetail {
  id: number;
  customerId: number;
  customerName: string;
  campanyName: string | null;
  subTotal: number;
  discount: number;
  netTotal: number;
  notes: string | null;
  items: PriceQuotationItem[];
  createdAt?: string | null;
}

/** Query params for `GET /PriceQuotations`. */
export interface PriceQuotationListQuery {
  PageIndex?: number;
  PageSize?: number;
  /** Optional server-side filter by customer. */
  CustomerId?: number;
}

/**
 * Paged envelope returned by `GET /PriceQuotations`.
 *
 * Distinct from the generic `PagedResult<T>` — this endpoint uses
 * `totalCount`/`totalPages` instead of `count`. Kept as its own type so we
 * don't reshape it and lose `totalPages`.
 */
export interface PriceQuotationPage {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  data: PriceQuotationListItem[];
}
