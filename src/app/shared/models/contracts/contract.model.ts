/**
 * Models for the `Contracts/*` endpoints.
 */

/**
 * Backend `ContractStatus` enum. The API (de)serialises it as a STRING
 * (`"Active" | "Expired" | "Cancelled"`) — both in responses and in the
 * create/update bodies.
 */
export type ContractStatus = 'Active' | 'Expired' | 'Cancelled';

/** Kept as an alias for older imports. */
export type ContractStatusName = ContractStatus;

export const CONTRACT_STATUSES: ReadonlyArray<ContractStatus> = ['Active', 'Expired', 'Cancelled'];

/**
 * Reads a status from the API defensively: the documented string form
 * (any casing), or a numeric code from older payloads (0- or 1-based is
 * ambiguous, so numbers follow the enum's declaration order starting at 0,
 * which is what ASP.NET emits without a string converter). Unknown → null.
 */
export function parseContractStatus(raw: unknown): ContractStatus | null {
  if (typeof raw === 'string') {
    const match = CONTRACT_STATUSES.find((s) => s.toLowerCase() === raw.trim().toLowerCase());
    if (match) return match;
    const n = Number(raw);
    return Number.isInteger(n) ? CONTRACT_STATUSES[n] ?? null : null;
  }
  if (typeof raw === 'number' && Number.isInteger(raw)) return CONTRACT_STATUSES[raw] ?? null;
  return null;
}

/** Body for `POST /Contracts/CreateContract`. */
export interface CreateContractRequest {
  title: string;
  description: string;
  customerId: number;
  status: ContractStatus;
  price: number;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time; `null` = open-ended contract. */
  endDate: string | null;
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
  status: ContractStatus;
  price: number;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time; `null` = open-ended contract. */
  endDate: string | null;
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
  status: ContractStatus;
  statusName?: string;
  price: number;
  startDate: string;
  endDate: string | null;
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
  status: ContractStatus;
  statusName?: string;
  price: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

/** Query params for `GET /Contracts/GetContracts`. */
export interface ContractListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
}
