/**
 * Models for the `Contracts/*` endpoints.
 */

/** Backend contract status — numeric codes accepted/returned by the API. */
export enum ContractStatusCode {
  Active = 1,
  Expired = 2,
  Cancelled = 3,
}

export type ContractStatusName = 'Active' | 'Expired' | 'Cancelled';

export const CONTRACT_STATUSES: ReadonlyArray<{
  code: ContractStatusCode;
  name: ContractStatusName;
}> = [
  { code: ContractStatusCode.Active, name: 'Active' },
  { code: ContractStatusCode.Expired, name: 'Expired' },
  { code: ContractStatusCode.Cancelled, name: 'Cancelled' },
];

/** Body for `POST /Contracts/CreateContract`. */
export interface CreateContractRequest {
  title: string;
  description: string;
  customerId: number;
  status: ContractStatusCode;
  price: number;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time. */
  endDate: string;
}

/**
 * Body for `PUT /Contracts/UpdateContract/{id}`.
 *
 * The customer can't be reassigned on edit — the backend only accepts these
 * six fields.
 */
export interface UpdateContractRequest {
  title: string;
  description: string;
  status: ContractStatusCode;
  price: number;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time. */
  endDate: string;
}

/**
 * Full contract returned by `GET /Contracts/GetContractById/{id}`.
 *
 * Drives both the edit dialog and the printable sale-contract document.
 * Note the field is `companyName` here (correctly spelled) — unlike the
 * price-quotation endpoints which serialize it as `campanyName`.
 */
export interface ContractDetail {
  id: number;
  title: string;
  description: string;
  customerId: number;
  customerName: string;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  createdById: string;
  createdByName: string;
  status: ContractStatusCode;
  statusName: ContractStatusName | string;
  price: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

/** Payload of `GET /Contracts/ContractStatistics`. */
export interface ContractStatistics {
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  expiringSoonContracts: number;
}

/** Row returned by `GET /Contracts/GetContracts` (paged `data[]`). */
export interface ContractListItem {
  id: number;
  title: string;
  description: string;
  customerId: number;
  customerName: string;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  createdById: string;
  createdByName: string;
  status: ContractStatusCode;
  statusName: ContractStatusName | string;
  price: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

/** Query params for `GET /Contracts/GetContracts`. */
export interface ContractListQuery {
  PageIndex?: number;
  PageSize?: number;
}
