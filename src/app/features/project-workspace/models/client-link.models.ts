/**
 * The customer's private portal link, as staff manage it
 * (`ClientPortalLinks/*`, `ManagerProjects/{id}/client-link`).
 */

export type LinkScope = 'AllProjects' | 'SelectedProjects';

export interface ClientPortalLink {
  id: number;
  customerId: number;
  customerName: string | null;
  /** The full URL — only filled right after create / regenerate / reveal. */
  url: string | null;
  /** e.g. `https://portal.theone…/p/••••a9F2`. */
  urlMasked: string;
  tokenHint: string;
  label: string | null;
  scope: LinkScope;
  projectIds: number[];
  expiresAt: string | null;
  hasPin: boolean;
  isActive: boolean;
  createdAt: string;
  createdByName: string | null;
  lastUsedAt: string | null;
  useCount: number;
}

/** Derived status for the chip. */
export type LinkState = 'Active' | 'Revoked' | 'Expired';

export function linkState(link: Pick<ClientPortalLink, 'isActive' | 'expiresAt'>, now = Date.now()): LinkState {
  if (link.expiresAt && Date.parse(link.expiresAt) <= now) return 'Expired';
  return link.isActive ? 'Active' : 'Revoked';
}

export interface ProjectLinkCustomer {
  id: number;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
}

/** `GET ManagerProjects/{id}/client-link`. */
export interface ProjectClientLink {
  hasLink: boolean;
  /** `includesThisProject` false ⇒ the link exists but is scoped to other projects. */
  link: (ClientPortalLink & { includesThisProject: boolean }) | null;
  customer: ProjectLinkCustomer;
}

/** `POST ClientPortalLinks` / `POST ManagerProjects/{id}/client-link`. */
export interface CreateLinkInput {
  label?: string | null;
  scope: LinkScope;
  projectIds?: number[];
  /** ISO, `null` = never. */
  expiresAt?: string | null;
  /** 4–6 digits, `null` = no PIN. */
  pin?: string | null;
}

/** `PATCH ClientPortalLinks/{id}` — omitted = unchanged; `clearExpiry: true` removes the expiry; `pin: ""` removes. */
export interface UpdateLinkInput {
  label?: string | null;
  scope?: LinkScope;
  projectIds?: number[];
  expiresAt?: string | null;
  clearExpiry?: boolean;
  pin?: string;
}

export type LinkAccessEvent =
  | 'SessionStarted'
  | 'SessionRefused'
  | 'ApkDownloaded'
  | 'CredentialRevealed'
  | 'RequestCreated'
  | 'CommentAdded';

export interface LinkAccessLogEntry {
  id: number;
  at: string;
  event: LinkAccessEvent;
  ip: string | null;
  userAgent: string | null;
  visitorName: string | null;
  projectId: number | null;
  projectName: string | null;
  reason: string | null;
}

export const LINK_PIN_PATTERN = /^\d{4,6}$/;
