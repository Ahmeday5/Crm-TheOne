/**
 * Contracts for `/api/WhatsApp/*` and the `/hubs/whatsapp` SignalR hub.
 *
 * The backend fronts Wavex: the browser never sees Wavex or its API key.
 * Every timestamp is UTC (render with `cairoDate`), and `mediaUrl` is
 * server-relative (resolve with `assetUrl`).
 */

// ─────────────── numbers / channels ───────────────

/** Connection state of a number on Wavex. */
export type WaInstanceStatus =
  | 'WORKING'
  | 'DISCONNECTED'
  | 'QR_REQUIRED'
  | 'CONNECTING'
  | 'INITIALIZING'
  | 'BANNED'
  | 'UNKNOWN';

/** `GET /status` — the caller's own sending number, live from the provider. */
export interface WaNumberStatus {
  instanceId: string | null;
  isAssigned: boolean;
  /** Admin without an own number → the company number. */
  isDefault: boolean;
  name: string | null;
  phoneNumber: string | null;
  status: WaInstanceStatus | 'NOT_ASSIGNED';
  /** `true` only while `WORKING`. */
  canSend: boolean;
  /** `QR_REQUIRED` or `DISCONNECTED` — the phone must be linked again. */
  requiresRelink: boolean;
  lastSeenAt: string | null;
  lastConnectedAt: string | null;
  /** A pairing code is active until this time. */
  pairingExpiresAt: string | null;
}

/** One company number — a "channel" in the admin inbox. */
export interface WaInstance {
  /** Wavex instance id — sent as `instanceId` everywhere, never displayed. */
  id: string;
  name: string | null;
  phoneNumber: string | null;
  status: WaInstanceStatus;
  canSend: boolean;
  requiresRelink: boolean;
  isDefault: boolean;
  assignedUserId: string | null;
  assignedUserName: string | null;
  lastSeenAt: string | null;
  lastConnectedAt: string | null;
  lastSyncedAt: string | null;
  /** `false` = removed from the provider: shown greyed and read-only. */
  existsInWavex: boolean;
  chatsCount: number;
  unreadChatsCount: number;
  pairingExpiresAt: string | null;
}

/** `POST /instances/connect` — the code the employee types on the phone. Never stored or logged. */
export interface WaPairingCode {
  instanceId: string;
  pairingCode: string;
  expiresInSeconds: number;
  expiresAt: string;
}

export interface WaConnectRequest {
  /** International format, e.g. `+201012345678`. */
  phone: string;
  /** Admin only — the channel to link. */
  instanceId?: string;
}

/** Body of `PUT /users/{userId}/number` — `null` unassigns. */
export interface WaAssignNumberRequest {
  instanceId: string | null;
}

// ─────────────── chats & messages ───────────────

/** One conversation between one of our numbers and one customer phone. */
export interface WaChat {
  id: number;
  instanceId: string;
  instancePhoneNumber: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  /** Digits only, international, e.g. `201012345678`. */
  phone: string;
  /** Name from the customer's WhatsApp profile. */
  contactName: string | null;
  /** Linked CRM customer, when the phone matches one. */
  customerId: number | null;
  customerName: string | null;
  companyName: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
}

/** Delivery state. Incoming messages are always `Received`. */
export type WaMessageStatus = 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | 'Received';

export type WaDirection = 'Incoming' | 'Outgoing';

/** Wavex's message kinds — open-ended, so unknown kinds still type-check. */
export type WaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | (string & {});

export interface WaMessage {
  id: number;
  chatId: number;
  externalMessageId: string | null;
  /** The id we generated when sending — matches an optimistic bubble to its stored row. */
  clientMessageId: string | null;
  direction: WaDirection;
  messageType: WaMessageType;
  /** Body, or the caption of a media message. */
  text: string | null;
  /** Server-relative; `null` for incoming media (provider limitation). */
  mediaUrl: string | null;
  fileName: string | null;
  status: WaMessageStatus;
  sentById: string | null;
  /** CRM user who sent it — `null` when sent from the phone, or incoming. */
  sentByName: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  /** Reason when `status === 'Failed'`. */
  errorMessage: string | null;
}

export interface Pagination<T> {
  pageIndex: number;
  pageSize: number;
  count: number;
  data: T[];
}

/** Query for `GET /chats` — `pageIndex` is 1-based, `pageSize` ≤ 100. */
export interface WaChatsQuery {
  pageIndex: number;
  pageSize: number;
  search?: string;
  /** Admin only — one channel's chats. */
  instanceId?: string;
  unreadOnly?: boolean;
}

/** Query for `GET /chats/{id}/messages` — results are oldest first. */
export interface WaMessagesQuery {
  take: number;
  /** Only messages older than this id (history paging). */
  beforeId?: number;
}

/** Exactly one target per send. */
export type WaSendTarget = { chatId: number } | { customerId: number } | { phone: string };

export interface WaSendTextRequest {
  target: WaSendTarget;
  text: string;
  /** Idempotency key — reuse it only when retrying after a network error. */
  clientMessageId: string;
  /** Admin only — the number to send from (new chats). */
  instanceId?: string;
}

export interface WaSendMediaRequest {
  target: WaSendTarget;
  file: File;
  caption?: string;
  clientMessageId: string;
  instanceId?: string;
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
}

/** `whatsappInstanceStatus` — a number's connection changed. */
export interface WaInstanceStatusEvent {
  instance: WaInstance;
  previousStatus: string | null;
  becameConnected: boolean;
}

// ─────────────── admin diagnostics ───────────────

/** `GET /diagnostics` (Admin) — is the integration wired correctly end to end? */
export interface WaDiagnostics {
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  defaultInstanceId: string | null;
  /** What the configured Wavex account actually holds. */
  wavexAccountInstances: { id: string; phoneNumber: string | null; status: string | null }[];
  /** Set when the provider couldn't be reached / rejected the key. */
  wavexError: string | null;
  localInstances: WaDiagnosticsLocalInstance[];
  pendingWebhookEvents: number;
  failedWebhookEvents: number;
  recentWebhookEvents: WaWebhookEvent[];
}

export interface WaDiagnosticsLocalInstance {
  instanceId: string;
  phoneNumber: string | null;
  status: string | null;
  /** `false` = stored locally but missing from the configured Wavex account. */
  inCurrentWavexAccount: boolean;
  ownerUserId: string | null;
  ownerName: string | null;
  chatsCount: number;
}

export interface WaWebhookEvent {
  id: number;
  eventType: string;
  instanceId: string | null;
  instancePhoneNumber: string | null;
  instanceOwnerName: string | null;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
}

// ─────────────── UI-side ───────────────

/** Someone who can own a number (from `GET /Auth/GetAllUsers`). */
export interface WaEmployee {
  userId: string;
  fullName: string;
  role: 'Sales' | 'Support';
}
