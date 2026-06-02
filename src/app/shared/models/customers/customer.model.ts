/**
 * Row shape returned by `GET /Customers/getLeadCustomer`.
 *
 * This is the lightweight projection used in the table — detail fields
 * (`email`, `companyName`, `notes`, …) are only loaded on demand via
 * `GET /Customers/{id}/getCustomerById`.
 */
/** Service reference `{ id, name }` as returned across the customer endpoints. */
export interface CustomerServiceRef {
  id: number;
  name: string;
}

export interface CustomerListItem {
  id: number;
  fullName: string;
  phone: string;
  address: string | null;
  source: string | null;
  campaignName: string | null;
  services: CustomerServiceRef[];
  status: string;
  salesPersonId?: string | null;
  salesPersonName: string | null;
  supportPersonId?: string | null;
  supportPersonName?: string | null;
  createdAt: string;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
  isMarketingToSales?: boolean;
  isSalesToSupport?: boolean;
  isSupportToSales?: boolean;
  /**
   * Whether the support team has completed its consultation and handed the
   * customer back to a sales rep. Flipped to `true` by
   * `POST /Support/{id}/AssignToSales`. Present on the sales + support list
   * endpoints; omitted by older endpoint versions.
   */
  isConsulted?: boolean;
  /** Latest note left by the marketing team (read-only here). */
  noteMarketing?: string | null;
  /** Latest note left by the sales team (read-only here). */
  noteSales?: string | null;
  /** Latest note left by the support team (read-only here). */
  noteSupport?: string | null;
  /**
   * Reason supplied when the customer was moved to `NotBuyer`.
   *
   * Non-null only when `status === 'NotBuyer'`. For buyers and any other
   * status the backend returns `null` — and the field is omitted entirely
   * by older endpoint versions that don't yet emit it.
   */
  notBuyerReason?: string | null;
}

/** Role-specific slot of a customer note. */
export type CustomerNoteRole = 'Marketing' | 'Sales' | 'Support';

/**
 * Body for `PUT /CustomerNotes/customer/{id}/myNote`.
 *
 * The backend reads the caller's role from the JWT and writes the value
 * into the matching slot — the request is just `{ note }`, never role-keyed.
 */
export interface SaveCustomerNoteRequest {
  note: string;
}

/** Response payload for `PUT /CustomerNotes/customer/{id}/myNote`. */
export interface CustomerNoteResponse {
  id: number;
  customerId: number;
  customerName: string | null;
  noteMarketing: string | null;
  marketingRole: string | null;
  noteSales: string | null;
  salesRole: string | null;
  noteSupport: string | null;
  supportRole: string | null;
  createdById: string | null;
  noteMarketingName: string | null;
  noteSalesName: string | null;
  noteSupportName: string | null;
  createdAt: string;
}

/**
 * Full customer returned by `GET /Customers/{id}/getCustomerById`.
 *
 * Note the backend serializes the company as `campanyName` (sic) here — the
 * same typo the price-quotation dropdown uses. The role notes
 * (`noteMarketing` / `noteSales` / `noteSupport`) are read-only in this view;
 * each role edits its own slot through `PUT /CustomerNotes/customer/{id}/myNote`.
 */
export interface CustomerDetails {
  id: number;
  fullName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  campanyName: string | null;
  campaignId: number | null;
  source: string | null;
  campaignName: string | null;
  services: CustomerServiceRef[];
  status: number;
  statusName: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  supportPersonId: string | null;
  supportPersonName: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isMarketingToSales?: boolean;
  isSalesToSupport?: boolean;
  isSupportToSales?: boolean;
  noteMarketing?: string | null;
  noteSales?: string | null;
  noteSupport?: string | null;
}

/** Body for `POST /Customers/CreateCustomer`. */
export interface CreateCustomerRequest {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  notes: string;
  campaignId: number | null;
  serviceIds: number[];
  assignToSalesTeam: boolean;
  salesPersonId: string | null;
}

/**
 * Body for `PUT /Customers/updateCustomer/{id}`.
 *
 * Mirrors the full backend DTO. `notes` must be sent on every update — the
 * endpoint replaces the record from the body, so omitting it (the previous
 * behaviour) made the backend treat the payload as incomplete and skip the
 * write entirely (e.g. an edited `companyName` silently never persisted). The
 * dialog round-trips the existing note value so a plain profile edit doesn't
 * wipe it; the role-specific note slots still flow through `…/myNote`.
 */
export interface UpdateCustomerRequest {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  address: string;
  notes: string;
  campaignId: number | null;
  serviceIds: number[];
}

/** Body for `POST /Customers/{id}/assign`. */
export interface AssignCustomerRequest {
  salesPersonId: string;
}

/** Body for `POST /Customers/{id}/AssignToSupportPerson`. */
export interface AssignSupportRequest {
  supportPersonId: string;
}

/**
 * Body for `PUT /Customers/{id}/status`.
 *
 * The backend enforces that `notBuyingReason` is non-empty when `status`
 * resolves to `NotBuyer` (statusId 5) and rejects with HTTP 400 otherwise.
 * For any other status the field should be omitted.
 */
export interface ChangeCustomerStatusRequest {
  status: number;
  /** Required only when transitioning to `NotBuyer`. */
  notBuyingReason?: string;
}

/** Body for `POST /Customers/{id}/followUp`. */
export interface UpdateFollowUpRequest {
  lastFollowUpDate: string;
  nextFollowUpDate: string;
}

/** Returned by `POST /Customers/{id}/followUp` and `…/status`. */
export interface CustomerFollowUpResponse {
  id: number;
  fullName: string;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
}

/** Dropdown item returned by `GET /Customers/statuses`. */
export interface CustomerStatus {
  id: number;
  name: string;
}

/** Sales team member returned by `GET /Auth/sales`. */
export interface SalesPerson {
  userId: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  address: string | null;
}

/** Support team member returned by `GET /Auth/support`. Same shape as SalesPerson. */
export interface SupportPerson {
  userId: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  address: string | null;
}

/** Query params accepted by `GET /Customers/getLeadCustomer`. */
export interface CustomerListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
  SourceId?: number;
  CustomerStatusId?: number;
}
