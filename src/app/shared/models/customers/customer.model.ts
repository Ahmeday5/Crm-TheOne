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
  /** Full activity log returned inline by the list endpoints. May be empty []. */
  activities?: CustomerActivity[];
}

/** Response shape from `GET Support/CustomerStats`. */
export interface SupportCustomerStats {
  totalCustomers: number;
  consultedCustomers: number;
  waitingConsultation: number;
  customersWithNotes: number;
}

/**
 * Single entry in a customer's activity log.
 * Returned inline inside `CustomerListItem.activities` by the list endpoints.
 */
export interface CustomerActivity {
  id: number;
  activityType: CustomerActivityType;
  /** Non-null only when activityType === 'ContactAttempted'. */
  contactResult: ContactResult | null;
  /** Previous status string — non-null only when activityType === 'StatusChanged'. */
  fromStatus: string | null;
  /** Next status string — non-null only when activityType === 'StatusChanged'. */
  toStatus: string | null;
  createdByName: string | null;
  createdAt: string;
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
  isConsulted?: boolean;
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
 * Exact string values the backend `CustomerStatus` enum serializes to.
 * These are the values sent in `PUT /Customers/{id}/status`.
 * Numeric IDs: New=1, Negotiating=3, Buyer=4, NotBuyer=5.
 */
export type CustomerStatusEnum = 'New' | 'Negotiating' | 'Buyer' | 'NotBuyer';

/**
 * Body for `PUT /Customers/{id}/status`.
 *
 * The backend expects the enum **name** as a string (e.g. `"Negotiating"`),
 * not the numeric ID. `notBuyingReason` is required when `status === "NotBuyer"`.
 */
export interface ChangeCustomerStatusRequest {
  status: CustomerStatusEnum;
  /** Required only when transitioning to `NotBuyer`. */
  notBuyingReason?: string;
}

/** Body for `POST /Customers/{id}/followUp`. */
export interface UpdateFollowUpRequest {
  lastFollowUpDate: string;
  nextFollowUpDate: string;
}

/**
 * Shared response shape returned by:
 *   - `PUT  /Customers/{id}/status`
 *   - `POST /Customers/{id}/followUp`
 *   - `POST /Customers/{id}/contact`
 *
 * The backend returns a lightweight customer projection — it intentionally
 * omits `status` (use cache-invalidation + reload to get the fresh status).
 */
export interface CustomerFollowUpResponse {
  id: number;
  fullName: string;
  address: string | null;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
  isMarketingToSales: boolean;
  isSalesToSupport: boolean;
  isSupportToSales: boolean;
  noteMarketing: string | null;
  noteSales: string | null;
  noteSupport: string | null;
}

/** Dropdown item returned by `GET /Customers/statuses`. */
export interface CustomerStatus {
  id: number;
  name: string;
}

/**
 * Maps to the backend `ContactResult` enum.
 * Answered = 1, NoAnswer = 2, Busy = 3, WrongNumber = 4.
 */
export type ContactResult = 'Answered' | 'NoAnswer' | 'Busy' | 'WrongNumber';

/**
 * Maps to the backend `CustomerActivityType` enum.
 * CustomerCreated=1, AssignedToSalesTeam=2, ContactAttempted=3,
 * SentQuote=4, TransferredToSupport=5, StatusChanged=6, ReturnedToSales=7.
 */
export type CustomerActivityType =
  | 'CustomerCreated'
  | 'AssignedToSalesTeam'
  | 'ContactAttempted'
  | 'SentQuote'
  | 'TransferredToSupport'
  | 'StatusChanged'
  | 'ReturnedToSales';

/** Body for `POST /Customers/{id}/contact`. */
export interface LogContactAttemptRequest {
  result: ContactResult;
  notes?: string;
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
