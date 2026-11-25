/**
 * Contracts for `/api/WhatsApp/*` and the `/hubs/whatsapp` SignalR hub.
 *
 * The backend fronts Mihwar (official WhatsApp Business API + Facebook
 * Messenger): the browser never talks to the provider. A "channel" is a
 * WhatsApp number or a Messenger page; the API still names its id
 * `instanceId`. Every timestamp is UTC (render with `cairoDate`).
 */

// ─────────────── envelope ───────────────

/** Re-exported for feature code: every success is `{ statusCode, message, data }`. */
export type { ApiResponse } from '../../../core/models/api-response.model';

export interface Pagination<T> {
  pageIndex: number;
  pageSize: number;
  count: number;
  data: T[];
}

// ─────────────── channels ───────────────

export type WaChannelType = 'whatsapp_cloud' | 'messenger' | 'instagram';

/** Connection state of a channel on Mihwar. */
export type WaInstanceStatus = 'CONNECTED' | 'DISCONNECTED' | 'INACTIVE' | 'UNKNOWN';

/** `GET /status` — the caller's own WhatsApp number. */
export interface WaNumberStatus {
  instanceId: string | null;
  status: WaInstanceStatus | 'NOT_ASSIGNED';
  canSend: boolean;
  /** Disconnected / inactive — must be re-linked in the Mihwar dashboard. */
  requiresRelink: boolean;
  name: string | null;
  phoneNumber: string | null;
  isAssigned: boolean;
  /** Admin without an own number → the company number. */
  isDefault: boolean;
}

/** One channel: a WhatsApp number or a Messenger page. */
export interface WaInstance {
  /** Mihwar channel id (e.g. `"217"`) — sent as `instanceId`. */
  id: string;
  type: WaChannelType;
  name: string | null;
  /** Usually `null` (Mihwar doesn't return it) — display `name`. */
  phoneNumber: string | null;
  status: WaInstanceStatus;
  canSend: boolean;
  requiresRelink: boolean;
  isDefault: boolean;
  assignedUserId: string | null;
  assignedUserName: string | null;
  lastConnectedAt: string | null;
  lastSyncedAt: string | null;
  /** `false` = removed from the provider: shown greyed and read-only. */
  existsInProvider: boolean;
  chatsCount: number;
  unreadChatsCount: number;
}

/**
 * Body of `PUT /users/{userId}/number`. A channel replaces only the user's
 * channel of the same type; `null` removes ALL of the user's channels.
 */
export interface WaAssignNumberRequest {
  instanceId: string | null;
}

// ─────────────── chats & messages ───────────────

/** One conversation between one of our channels and one customer. */
export interface WaChat {
  id: number;
  instanceId: string;
  /** e.g. "shahd Shereef" / "The One System co." */
  instanceName: string | null;
  instancePhoneNumber: string | null;
  channelType: WaChannelType;
  ownerUserId: string | null;
  ownerName: string | null;
  /** Digits only, e.g. `201124612772`; `null` for Messenger. */
  phone: string | null;
  contactName: string | null;
  customerId: number | null;
  customerName: string | null;
  companyName: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** A free-form text / file is allowed right now (24-hour window open). */
  canReply: boolean;
  replyWindowEndsAt: string | null;
  /** WhatsApp only: an approved template may be sent. */
  canSendTemplate: boolean;
  /**
   * Always `false` in lists (the server never returns deleted chats). `true`
   * only on the `whatsappChatUpdated` event that announces a deletion.
   */
  isDeleted?: boolean;

  // ── inbox v4 (`docs/backend-prompt-inbox-v4.md` §10) — optional until every backend build sends them ──
  /** Team labels (§2). */
  labels?: WaChatLabel[];
  /** Internal notes on this chat (§3). */
  notesCount?: number;
  /** Earliest pending / due reminder of ANY user on this chat (§4). */
  nextReminderAt?: string | null;
  /** A reminder on this chat is already due. */
  reminderDue?: boolean;
  /** Direction of the latest message (§5). */
  lastMessageDirection?: WaDirection | null;
  /** Oldest incoming message after our last reply; `null` when we spoke last (§5). */
  awaitingReplySince?: string | null;
  /** Transfer (§7): the Sales colleague now handling the chat — they reply through the same channel. */
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: string | null;
}

/** Delivery state. Incoming messages are always `Received`. */
export type WaMessageStatus = 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | 'Received';

export type WaDirection = 'Incoming' | 'Outgoing';

/** Open-ended so unknown provider kinds still type-check. */
export type WaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'template'
  | 'location'
  | 'reaction'
  | 'system'
  | (string & {});

export interface WaMessage {
  id: number;
  chatId: number;
  externalMessageId: string | null;
  /** The id we generated when sending — matches an optimistic bubble to its stored row. */
  clientMessageId: string | null;
  direction: WaDirection;
  messageType: WaMessageType;
  /** Body, a media caption, or a template's rendered body. */
  text: string | null;
  /** Relative (`/Images/WhatsApp/…`) for files we sent; absolute for received media. */
  mediaUrl: string | null;
  fileName: string | null;
  templateName: string | null;
  status: WaMessageStatus;
  sentById: string | null;
  /** `null` = sent from the Mihwar inbox / an automation, or incoming. */
  sentByName: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  /** Reason when `status === 'Failed'`. */
  errorMessage: string | null;
}

/** Query for `GET /chats` — `pageIndex` is 1-based. */
export interface WaChatsQuery {
  pageIndex: number;
  pageSize: number;
  search?: string;
  /** Admin only — one channel's chats. */
  instanceId?: string;
  unreadOnly?: boolean;
  /** §2 — one label code. */
  label?: WaChatLabel;
  /** §5 — only chats waiting for our reply longer than the threshold, oldest first. */
  awaitingReply?: boolean;
  /** §5 — only chats with a pending / due reminder, earliest first. */
  hasReminder?: boolean;
}

/** Query for `GET /chats/{id}/messages` — results are oldest first. */
export interface WaMessagesQuery {
  take: number;
  /** Only messages older than this id (history paging). */
  beforeId?: number;
}

// ─────────────── sending ───────────────

/** Exactly one target per send. */
export type WaSendTarget = { chatId: number } | { customerId: number } | { phone: string };

export interface WaSendTextRequest {
  target: WaSendTarget;
  text: string;
  /** Idempotency key — reuse it only when retrying the same message. */
  clientMessageId: string;
  /** Admin only — the channel to send from (new chats). */
  instanceId?: string;
}

/** `send-media` only targets an existing chat. */
export interface WaSendMediaRequest {
  chatId: number;
  file: File;
  caption?: string;
  clientMessageId: string;
}

/** `whatsapp_cloud` only — a Meta-approved template. */
export interface WaTemplate {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  instanceId: string;
  /** Body with `{{variable}}` placeholders. */
  body: string;
  variables: string[];
  /** Only sendable templates are offered. */
  sendable: boolean;
}

export interface WaSendTemplateRequest {
  target: WaSendTarget;
  clientMessageId: string;
  templateId: number;
  /** The template's name — sent alongside the id for the backend's lookup. */
  template?: string;
  language?: string;
  /** Values keyed by variable name. */
  parameters?: Record<string, string>;
  /** Admin only. */
  instanceId?: string;
}

/** Upload progress of `send-media`, then the stored message. */
export type WaUploadEvent =
  | { kind: 'progress'; percent: number }
  | { kind: 'done'; message: WaMessage };

// ─────────────── admin ───────────────

/** `POST /import` — idempotent; safe to run again. */
export interface WaImportResult {
  conversations: number;
  newChats: number;
  newMessages: number;
  skipped: number;
  /** Per-conversation failures (provider message or a structured row). */
  errors: (string | Record<string, unknown>)[];
}

/** A channel as Mihwar reports it (diagnostics). Every field may be missing. */
export interface WaProviderChannel {
  id: string;
  type?: WaChannelType | string | null;
  name?: string | null;
  phoneNumber?: string | null;
  status?: string | null;
}

export interface WaWebhookEvent {
  id: number;
  eventType: string;
  instanceId: string | null;
  attempts?: number;
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
}

/** `GET /diagnostics` (Admin) — is the integration wired correctly end to end? */
export interface WaDiagnostics {
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  /** Set when the provider couldn't be reached / rejected the key. */
  providerError: string | null;
  providerChannels: WaProviderChannel[];
  pendingWebhookEvents: number;
  failedWebhookEvents: number;
  recentWebhookEvents: WaWebhookEvent[];
}

// ─────────────── real-time hub events ───────────────

/** `whatsappMessage` — a new incoming or outgoing message (any sender). */
export interface WaMessageEvent {
  instanceId: string;
  chat: WaChat;
  message: WaMessage;
}

/** `whatsappMessageStatus` — delivery progress of an outgoing message. */
export interface WaMessageStatusEvent {
  instanceId: string;
  chatId: number;
  messageId: number;
  externalMessageId: string | null;
  status: WaMessageStatus;
  deliveredAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
}

/** `whatsappInstanceStatus` — a channel's connection changed. */
export interface WaInstanceStatusEvent {
  instance: WaInstance;
  previousStatus: string | null;
  becameConnected: boolean;
}

// ─────────────── inbox v4: chat tools (§2–§6) ───────────────

/** The fixed label set (§2) — stored as these strings. */
export type WaChatLabel = 'Interested' | 'QuoteSent' | 'AwaitingPayment' | 'FollowUp' | 'Closed';

/** Body of `PUT /chats/{id}/labels` — replaces the whole set; `[]` clears it. */
export interface WaSetLabelsRequest {
  labels: WaChatLabel[];
}

/** An internal note — team only, never sent to the customer (§3). */
export interface WaChatNote {
  id: number;
  chatId: number;
  text: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  /** Auto notes (e.g. a transfer) — reps can't delete them. */
  isSystem: boolean;
}

export type WaReminderStatus = 'Pending' | 'Due' | 'Done';

/** «ذكّرني» (§4). */
export interface WaChatReminder {
  id: number;
  chatId: number;
  customerId: number | null;
  contactName: string | null;
  dueAt: string;
  note: string | null;
  status: WaReminderStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

/** Body of `POST /chats/{id}/reminders` — `dueAt` in the future (UTC), `note` ≤ 300 chars. */
export interface WaNewReminderRequest {
  dueAt: string;
  note?: string | null;
}

/** Query for `GET /reminders` — the caller's own reminders. */
export interface WaRemindersQuery {
  status?: 'pending' | 'due' | 'done';
  pageIndex: number;
  pageSize: number;
  /** Admin only. */
  userId?: string;
}

/** `GET /chats/counters` — the two red badges (§5). */
export interface WaChatCounters {
  awaitingReply: number;
  overdueReminders: number;
  /** `AwaitingReplyThresholdMinutes` — the UI uses the server's number. */
  thresholdMinutes: number;
}

/** Body of `POST /chats/{id}/transfer` — Sales users only (§6). */
export interface WaTransferRequest {
  toUserId: string;
  message?: string;
}

/** `whatsappChatNoteAdded` hub event (§3). */
export interface WaChatNoteAddedEvent {
  chatId: number;
  note: WaChatNote;
}

// ─────────────── UI-side ───────────────

/** Someone who can own a channel (from `GET /Auth/GetAllUsers`). */
export interface WaEmployee {
  userId: string;
  fullName: string;
  role: 'Sales' | 'Support';
}
