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
  | (string & {});

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
