/**
 * Models for the `SupportTickets/*` endpoints.
 *
 * Enum values mirror the live backend contract (verified against the API):
 *   - Priority: High = 1, Medium = 2, Low = 3
 *   - Status:   Open = 0, InProgress = 1, WaitingCustomer = 2, Resolved = 3, Closed = 4
 *
 * The list filter (`GET /SupportTickets/GetTickets`) binds the *enum name*
 * (e.g. `Status=InProgress`, `Priority=High`) — so the metadata tables below
 * carry both `value` (for create/update bodies) and `enumName` (for filtering).
 *
 * Display labels are i18n keys so the UI stays fully bilingual. The reference
 * endpoints (`TicketStatuses` / `TicketPriorities`) return Arabic-only names,
 * so they are intentionally not used for rendering — the value↔enumName↔i18n
 * mapping here is the single source of truth.
 */

export enum SupportTicketPriority {
  High = 1,
  Medium = 2,
  Low = 3,
}

export enum SupportTicketStatus {
  Open = 0,
  InProgress = 1,
  WaitingCustomer = 2,
  Resolved = 3,
  Closed = 4,
}

/** Enum-name strings exactly as the backend serializes them (filter values). */
export type SupportTicketPriorityName = 'High' | 'Medium' | 'Low';
export type SupportTicketStatusName =
  | 'Open'
  | 'InProgress'
  | 'WaitingCustomer'
  | 'Resolved'
  | 'Closed';

export interface SupportTicketPriorityMeta {
  value: SupportTicketPriority;
  enumName: SupportTicketPriorityName;
  /** i18n key for the localized label. */
  i18nKey: string;
  /** CSS modifier class for the animated badge (see component SCSS). */
  badgeClass: string;
  icon: string;
}

export interface SupportTicketStatusMeta {
  value: SupportTicketStatus;
  enumName: SupportTicketStatusName;
  i18nKey: string;
  badgeClass: string;
  icon: string;
}

export const SUPPORT_TICKET_PRIORITIES: ReadonlyArray<SupportTicketPriorityMeta> = [
  {
    value: SupportTicketPriority.High,
    enumName: 'High',
    i18nKey: 'support.tickets.priority.high',
    badgeClass: 'tkt-prio--high',
    icon: 'fa-solid fa-fire-flame-curved',
  },
  {
    value: SupportTicketPriority.Medium,
    enumName: 'Medium',
    i18nKey: 'support.tickets.priority.medium',
    badgeClass: 'tkt-prio--medium',
    icon: 'fa-solid fa-circle-half-stroke',
  },
  {
    value: SupportTicketPriority.Low,
    enumName: 'Low',
    i18nKey: 'support.tickets.priority.low',
    badgeClass: 'tkt-prio--low',
    icon: 'fa-solid fa-arrow-down-long',
  },
];

export const SUPPORT_TICKET_STATUSES: ReadonlyArray<SupportTicketStatusMeta> = [
  {
    value: SupportTicketStatus.Open,
    enumName: 'Open',
    i18nKey: 'support.tickets.status.open',
    badgeClass: 'tkt-st--open',
    icon: 'fa-solid fa-folder-open',
  },
  {
    value: SupportTicketStatus.InProgress,
    enumName: 'InProgress',
    i18nKey: 'support.tickets.status.inProgress',
    badgeClass: 'tkt-st--progress',
    icon: 'fa-solid fa-spinner',
  },
  {
    value: SupportTicketStatus.WaitingCustomer,
    enumName: 'WaitingCustomer',
    i18nKey: 'support.tickets.status.waitingCustomer',
    badgeClass: 'tkt-st--waiting',
    icon: 'fa-solid fa-hourglass-half',
  },
  {
    value: SupportTicketStatus.Resolved,
    enumName: 'Resolved',
    i18nKey: 'support.tickets.status.resolved',
    badgeClass: 'tkt-st--resolved',
    icon: 'fa-solid fa-circle-check',
  },
  {
    value: SupportTicketStatus.Closed,
    enumName: 'Closed',
    i18nKey: 'support.tickets.status.closed',
    badgeClass: 'tkt-st--closed',
    icon: 'fa-solid fa-lock',
  },
];

/** value → meta lookups for O(1) badge rendering. */
export const SUPPORT_TICKET_PRIORITY_MAP: Readonly<
  Record<number, SupportTicketPriorityMeta>
> = Object.fromEntries(SUPPORT_TICKET_PRIORITIES.map((p) => [p.value, p]));

export const SUPPORT_TICKET_STATUS_MAP: Readonly<
  Record<number, SupportTicketStatusMeta>
> = Object.fromEntries(SUPPORT_TICKET_STATUSES.map((s) => [s.value, s]));

/**
 * Full ticket record — the same shape is returned by `GetTickets` (paged
 * `data[]`), `GetTicketById`, and the create/update responses.
 */
export interface SupportTicket {
  id: number;
  ticketNumber: number;
  title: string;
  description: string;
  customerId: number;
  customerName: string;
  companyName: string | null;
  serviceId: number;
  serviceName: string;
  priority: SupportTicketPriority;
  priorityName: SupportTicketPriorityName | string;
  status: SupportTicketStatus;
  statusName: SupportTicketStatusName | string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
  /** Set once the ticket is resolved; `null` until then. */
  resolvedAt: string | null;
  /**
   * Next follow-up date. The backend requires it while the ticket is `Open`
   * and returns `null` for any other status (or for older records).
   */
  nextFollowUpDate: string | null;
}

/** Body for `POST /SupportTickets/CreateTicket`. */
export interface CreateSupportTicketRequest {
  title: string;
  description: string;
  customerId: number;
  serviceId: number;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  /**
   * ISO date — **required** when `status` is `Open`, otherwise `null`. The
   * backend rejects an empty string (it can't parse it into a `DateTime?`).
   */
  nextFollowUpDate: string | null;
}

/**
 * Body for `PUT /SupportTickets/UpdateTicket/{id}`.
 *
 * The customer can't be reassigned on edit — the backend only accepts these
 * five fields (no `customerId`).
 */
export interface UpdateSupportTicketRequest {
  title: string;
  description: string;
  serviceId: number;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  /**
   * ISO date — **required** when `status` is `Open`, otherwise `null`. The
   * backend rejects an empty string (it can't parse it into a `DateTime?`).
   */
  nextFollowUpDate: string | null;
}

/** Query params for `GET /SupportTickets/GetTickets`. */
export interface SupportTicketListQuery {
  PageIndex?: number;
  PageSize?: number;
  /** Free-text search by ticket title or customer name. */
  Search?: string;
  /** Enum *name* — e.g. 'InProgress'. */
  Status?: SupportTicketStatusName;
  /** Enum *name* — e.g. 'High'. */
  Priority?: SupportTicketPriorityName;
}

/** Payload of `GET /SupportTickets/TicketStatistics`. */
export interface SupportTicketStatistics {
  totalTickets: number;
  resolvedTickets: number;
  highPriorityTickets: number;
  inProgressTickets: number;
  openTickets: number;
}
