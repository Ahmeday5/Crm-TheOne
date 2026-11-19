/**
 * Models for the `Notifications/*` endpoints (main CRM API).
 *
 * Notifications are per-user: the backend scopes every read to the caller's
 * JWT, so the list/count endpoints never need a user id. Only the admin
 * `send` endpoint targets a specific user.
 */

/** Known notification kinds — kept open for forward-compat with new types. */
export type NotificationType =
  | 'NewSupportTicket'
  | 'CustomerReturnedToSales'
  | 'NewCustomerAssigned'
  | 'CustomerTransferredToSupport'
  | 'AppointmentScheduled'
  | 'FollowUpReminder'
  | 'TaskAssigned'
  | 'ProjectAssigned'
  | 'GoalAssigned'
  | 'GoalAchieved'
  | 'WhatsAppMessageReceived'
  | 'Announcement'
  | 'LeaveRequestSubmitted'
  | 'LeaveRequestReviewed'
  /** 30, 7 and 1 days before `endDate` — creator + admins. */
  | 'ContractExpiringSoon'
  /** Once, the day after it ended. */
  | 'ContractExpired'
  /** Creator + admins, except whoever renewed it. */
  | 'ContractRenewed'
  // ── project workspace / client portal (2026-11-16) ──
  | 'ClientRequestCreated'
  | 'ClientRequestUpdated'
  | 'ClientRequestComment'
  // ── client requests v3 — triage gate (2026-11-19) — enum 28…32, payload carries `projectId` ──
  /** The client answered the Admin's question (to Admins). */
  | 'ClientRequestClarificationAnswered'
  /** Approved → to the client + the assignee / project developers. */
  | 'ClientRequestApproved'
  | 'ClientRequestAssigned'
  /** Declined → to the client only. */
  | 'ClientRequestRejected'
  /** The Admin asked the client something (to the client). */
  | 'ClientRequestClarificationRequested'
  // ── contract v2 (2026-11-17) — payload carries `projectId` ──
  /** A new app version is visible to the client. */
  | 'ProjectReleasePublished'
  /** A developer added / completed a milestone (to Admin / PM). */
  | 'MilestoneUpdatedByDeveloper'
  /** Progress hit 100% — the Admin closes the project. */
  | 'ProjectReachedFullProgress'
  // ── payment links (2026-11-18) — enum 27, entity `PaymentRequest` ──
  /** The customer pressed "I've paid" on `/pay/:token` (to the creator + Admins). */
  | 'PaymentConfirmedByCustomer'
  | (string & {});

/**
 * Notification types the backend may serialize by NUMBER instead of name.
 * Only the ones the UI branches on are listed; anything else passes through.
 */
const TYPE_BY_NUMBER: Readonly<Record<string, NotificationType>> = {
  '19': 'ClientRequestCreated',
  '20': 'ClientRequestUpdated',
  '21': 'ClientRequestComment',
  '27': 'PaymentConfirmedByCustomer',
  '28': 'ClientRequestClarificationAnswered',
  '29': 'ClientRequestApproved',
  '30': 'ClientRequestAssigned',
  '31': 'ClientRequestRejected',
  '32': 'ClientRequestClarificationRequested',
};

/** The type's NAME whether it arrived as `"ClientRequestApproved"`, `29` or `"29"`. */
export function notificationTypeName(type: NotificationType | number | null | undefined): NotificationType {
  const key = String(type ?? '');
  return TYPE_BY_NUMBER[key] ?? (key as NotificationType);
}

/** True for any client-request notification (name, number or entity). */
export function isClientRequestNotification(n: { type: NotificationType | number; relatedEntityType: string | null }): boolean {
  return n.relatedEntityType === CLIENT_REQUEST_ENTITY || notificationTypeName(n.type).startsWith('ClientRequest');
}

/** `relatedEntityType`s of the project workspace — `relatedEntityId` is that row's id. */
export const CLIENT_REQUEST_ENTITY = 'ClientRequest';
export const PROJECT_RELEASE_ENTITY = 'ProjectRelease';
export const PROJECT_MILESTONE_ENTITY = 'ProjectMilestone';
export const PROJECT_ENTITY = 'Project';

/** `relatedEntityType` of a contract notification — `relatedEntityId` is the contract id. */
export const CONTRACT_ENTITY = 'Contract';

const CONTRACT_TYPES: ReadonlySet<string> = new Set(['ContractExpiringSoon', 'ContractExpired', 'ContractRenewed']);

export function isContractNotification(n: { type: NotificationType | number; relatedEntityType: string | null }): boolean {
  return n.relatedEntityType === CONTRACT_ENTITY || CONTRACT_TYPES.has(String(n.type));
}

/** `relatedEntityType` of an announcement notification — `relatedEntityId` is its id. */
export const ANNOUNCEMENT_ENTITY = 'Announcement';
/** `relatedEntityType` of a leave-request notification. */
export const LEAVE_REQUEST_ENTITY = 'LeaveRequest';

/** `relatedEntityType` of a payment notification — `relatedEntityId` is the payment request id. */
export const PAYMENT_REQUEST_ENTITY = 'PaymentRequest';

/**
 * True for "the customer confirmed a transfer". The payload carries only the
 * request id — callers fetch `GET PaymentRequests/{id}` for the details.
 * The enum may serialize by name or by number (27).
 */
export function isPaymentNotification(n: { type: NotificationType | number; relatedEntityType: string | null }): boolean {
  return (
    n.relatedEntityType === PAYMENT_REQUEST_ENTITY ||
    n.type === 'PaymentConfirmedByCustomer' ||
    String(n.type) === '27'
  );
}

/** `relatedEntityType` of a WhatsApp notification — `relatedEntityId` is the chat id. */
export const WHATSAPP_CHAT_ENTITY = 'WhatsAppChat';

/**
 * True for an incoming-WhatsApp-message notification. The backend enum value
 * is 12; it may serialize by name or by number, so both are accepted.
 */
export function isWhatsAppNotification(n: {
  type: NotificationType | number;
  relatedEntityType: string | null;
}): boolean {
  return (
    n.relatedEntityType === WHATSAPP_CHAT_ENTITY ||
    n.type === 'WhatsAppMessageReceived' ||
    String(n.type) === '12'
  );
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  /** Domain object the notification points at (e.g. `SupportTicket`, `Customer`). */
  relatedEntityType: string | null;
  relatedEntityId: number | null;
}

/** Query params for `GET /Notifications`. */
export interface NotificationListQuery {
  PageIndex?: number;
  PageSize?: number;
  /** When true the backend returns only unread notifications. */
  UnreadOnly?: boolean;
}

/** Payload of `GET /Notifications/unread-count`. */
export interface UnreadCountResult {
  unreadCount: number;
}

/** Payload of `POST /Notifications/generate-followup-reminders`. */
export interface GenerateRemindersResult {
  created: number;
}

/** Body for `POST /Notifications/send` (admin only). */
export interface SendNotificationRequest {
  userId: string;
  title: string;
  message: string;
}
