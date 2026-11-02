/**
 * Contracts for the `/api/WhatsApp/*` endpoints.
 *
 * The backend fronts Wavex: the browser never sees Wavex or its API key.
 * Every timestamp is UTC (render with `cairoDate`), and `mediaUrl` is
 * server-relative (resolve with `assetUrl`).
 */

/** Delivery state of a message. Incoming messages are always `Received`. */
export type WhatsAppMessageStatus =
  | 'Pending'
  | 'Sent'
  | 'Delivered'
  | 'Read'
  | 'Failed'
  | 'Received';

export type WhatsAppDirection = 'Incoming' | 'Outgoing';

/** Wavex's message kinds — open-ended, so unknown kinds still type-check. */
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | (string & {});

/** Connection state of a linked number on Wavex. */
export type WhatsAppInstanceStatus =
  | 'WORKING'
  | 'QR_REQUIRED'
  | 'CONNECTING'
  | 'INITIALIZING'
  | 'DISCONNECTED'
  | 'BANNED'
  | (string & {});

/** One conversation between one of our numbers and one customer phone. */
export interface WhatsAppChat {
  id: number;
  /** Our number the conversation lives on. */
  instanceId: string;
  ownerUserId: string | null;
  /** Employee who owns that number — shown to Admins only. */
  ownerName: string | null;
  /** Customer phone in international form, no `+`. */
  phone: string;
  /** Name from the customer's WhatsApp profile. */
  contactName: string | null;
  /** `null` while the phone isn't registered as a customer. */
  customerId: number | null;
  customerName: string | null;
  companyName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface WhatsAppMessage {
  id: number;
  chatId: number;
  direction: WhatsAppDirection;
  messageType: WhatsAppMessageType;
  /** Body, or the caption of a media message. */
  text: string | null;
  /** Server-relative — present only on outgoing media. */
  mediaUrl: string | null;
  fileName: string | null;
  status: WhatsAppMessageStatus;
  sentById: string | null;
  sentByName: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  /** Failure reason when `status === 'Failed'`. */
  errorMessage: string | null;
}

/** `GET /WhatsApp/status` — the caller's sending number. */
export interface WhatsAppNumberStatus {
  instanceId: string;
  /** `true` when the caller has no own number and sends from the company's. */
  isDefault: boolean;
  phoneNumber: string | null;
  status: WhatsAppInstanceStatus;
}

/** `GET /WhatsApp/instances` (Admin) — one linked number. */
export interface WhatsAppInstance {
  /** Opaque Wavex id — used in requests only, never displayed. */
  id: string;
  name: string | null;
  phoneNumber: string | null;
  status: WhatsAppInstanceStatus;
  /** The company's default sending number. */
  isDefault: boolean;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

/** Query for `GET /WhatsApp/chats` (PascalCase, as the API expects). */
export interface WhatsAppChatsQuery {
  PageIndex: number;
  PageSize: number;
  Search?: string;
}

/**
 * Who a message goes to: a registered customer, or a bare phone for a chat
 * that isn't linked to a customer yet.
 */
export type WhatsAppRecipient = { customerId: number } | { phone: string };

export interface SendWhatsAppTextRequest {
  recipient: WhatsAppRecipient;
  text: string;
}

export interface SendWhatsAppMediaRequest {
  recipient: WhatsAppRecipient;
  file: File;
  caption?: string;
}

/** Body of `PUT /WhatsApp/users/{userId}/number` — `null` unlinks. */
export interface AssignWhatsAppNumberRequest {
  instanceId: string | null;
}

/** An employee who can own a number (merged from the role rosters). */
export interface WhatsAppEmployee {
  userId: string;
  fullName: string;
  role: 'Admin' | 'Sales' | 'Support';
}
