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
  salesPersonName: string | null;
  createdAt: string;
}

/**
 * Full detail shape returned by `GET /Customers/{id}/getCustomerById`.
 */
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

/** Query params accepted by `GET /Customers/getLeadCustomer`. */
export interface CustomerListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
  SourceId?: number;
  CustomerStatusId?: number;
}
