/**
 * Row shape returned by `GET /Customers/getLeadCustomer`.
 *
 * This is the lightweight projection used in the table — detail fields
 * (`email`, `companyName`, `notes`, …) are only loaded on demand via
 * `GET /Customers/{id}/getCustomerById`.
 */
export interface CustomerListItem {
  id: number;
  fullName: string;
  phone: string;
  source: string | null;
  campaignName: string | null;
  services: string[];
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

export interface CustomerDetails {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  companyName: string | null;
  notes: string | null;
  source: number;
  sourceName: string | null;
  campaignId: number | null;
  campaignName: string | null;
  serviceIds: number[];
  services: { id: number; name: string }[];
  status: number;
  statusName: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Body for `POST /Customers`. */
export interface CreateCustomerRequest {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
  campaignId: number | null;
  serviceIds: number[];
  assignToSalesTeam: boolean;
  salesPersonId: string | null;
}

/** Body for `PUT /Customers/updateCustomer/{id}`. */
export interface UpdateCustomerRequest {
  name: string;
  phone: string;
  email: string;
  companyName: string;
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
