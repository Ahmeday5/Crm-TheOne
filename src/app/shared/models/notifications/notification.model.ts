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
  | 'ProjectBuildPushed'
  | 'ProjectBuildFailed'
  | (string & {});

/** `relatedEntityType`s of the project workspace — `relatedEntityId` is that row's id. */
export const CLIENT_REQUEST_ENTITY = 'ClientRequest';
export const PROJECT_BUILD_ENTITY = 'ProjectBuild';
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
