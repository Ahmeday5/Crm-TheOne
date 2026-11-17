import { PortalCustomer } from './client-portal.models';

/** `POST ClientPortal/session` — trade the private link token for a portal JWT. */
export interface PortalSessionRequest {
  token: string;
  pin: string | null;
  visitorName: string | null;
}

export interface PortalSessionResponse {
  accessToken: string;
  /** ISO — re-exchange silently a little before this. */
  expiresAt: string;
  customer: PortalCustomer;
  visitorName: string | null;
  projectsCount: number;
}

/** What is kept on this device so the client never sees a login screen. */
export interface StoredPortalSession {
  linkToken: string;
  accessToken: string;
  expiresAt: string;
  customer: PortalCustomer;
  visitorName: string | null;
  projectsCount: number;
}

/**
 * Why a link could not open a session — the `reason` codes of the contract,
 * plus `network` (no answer) and `no_link` (opened `/portal` without a link).
 */
export type PortalLinkProblem =
  | 'link_invalid'
  | 'link_revoked'
  | 'link_expired'
  | 'pin_required'
  | 'pin_invalid'
  | 'pin_locked'
  | 'customer_inactive'
  | 'rate_limited'
  | 'network'
  | 'no_link';

export const PORTAL_LINK_PROBLEMS: ReadonlyArray<PortalLinkProblem> = [
  'link_invalid',
  'link_revoked',
  'link_expired',
  'pin_required',
  'pin_invalid',
  'pin_locked',
  'customer_inactive',
  'rate_limited',
  'network',
  'no_link',
];

/** Raised by the session layer — `retryAfterSec` for `pin_locked` / `rate_limited`. */
export class PortalLinkError extends Error {
  constructor(
    readonly problem: PortalLinkProblem,
    readonly retryAfterSec: number | null = null,
  ) {
    super(problem);
    this.name = 'PortalLinkError';
  }
}

/** Problems the client can fix on the same screen (type a PIN) vs. dead ends. */
export function isPinProblem(problem: PortalLinkProblem): boolean {
  return problem === 'pin_required' || problem === 'pin_invalid' || problem === 'pin_locked';
}
