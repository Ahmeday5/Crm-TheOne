/**
 * Models, DTOs and the chat view-model for the WhatsApp Messages module
 * (`{whatsappApiUrl}/sessions/{id}/messages*`).
 */

/** Delivery lifecycle the chat UI renders ticks/indicators for. */
export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'pending'
  | (string & {});

/** Raw record returned by the history endpoint. */
export interface WaMessage {
  id: number;
  session_id: number;
  from: string;
  to: string;
  message: string;
  status: string;
  delivery_status: DeliveryStatus;
  whatsapp_message_id: string | null;
  campaign_id: number | null;
  is_ai_generated: boolean;
  ai_prompt: string | null;
  error_message: string | null;
  metadata: unknown | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  read_at: string | null;
  channel_type: string;
}

export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface MessagesResponse {
  success: boolean;
  data: WaMessage[];
  pagination: Pagination;
}

// ─────────────── send DTOs ───────────────

export interface SendTextRequest {
  to: string;
  message: string;
}

export interface SendImageRequest {
  to: string;
  image_url: string;
  caption?: string;
}

export interface SendVideoRequest {
  to: string;
  video_url: string;
  caption?: string;
}

export interface SendDocumentRequest {
  to: string;
  document_url: string;
  mime_type: string;
  filename: string;
}

export interface SendAudioRequest {
  to: string;
  audio_url: string;
}

export interface SendLocationRequest {
  to: string;
  latitude: string;
  longitude: string;
  description: string;
}

export interface SendContactRequest {
  to: string;
  contact_name: string;
  contact_phone: string;
}

export interface SendResult {
  status: string;
  to: string;
  session_id: number;
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  message_en: string;
  data: SendResult;
}

// ─────────────── chat view-model ───────────────

export type MessageContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'contact';

export type MessageDirection = 'in' | 'out';

/** What the chat thread renders — server messages and optimistic ones share it. */
export interface MessageView {
  /** Stable key for tracking: `srv-<id>` for server rows, `tmp-<localId>` for optimistic. */
  key: string;
  /** Server id, or null while still optimistic. */
  id: number | null;
  /** Conversation (counterparty) this message belongs to. */
  conversationId: string;
  direction: MessageDirection;
  type: MessageContentType;
  /** Text body or caption. */
  text: string;
  /** Local preview (data URL / object URL / remote URL) for optimistic media. */
  mediaUrl?: string;
  mediaName?: string;
  mimeType?: string;
  /** Location preview. */
  latitude?: string;
  longitude?: string;
  /** Contact-card preview. */
  contactName?: string;
  contactPhone?: string;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  /** True until the server confirms the optimistic send. */
  optimistic: boolean;
  /** True when the send request failed (offers retry). */
  failed: boolean;
  /** Incoming media we have no URL for (history serialises it as "[Media]"). */
  mediaPlaceholder?: boolean;
}

/**
 * A 1:1 conversation, derived client-side by grouping the session's flat
 * message history by the counterparty (the gateway exposes no chats endpoint).
 */
export interface ChatConversation {
  /** Stable key (counterparty digits, or local-part when not numeric). */
  id: string;
  /** Phone the send endpoints target (`to`). */
  sendNumber: string;
  /** Display name — contact name when known, else the formatted number. */
  name: string;
  numberDisplay: string;
  avatarColor: string;
  initials: string;
  lastText: string;
  lastType: MessageContentType;
  lastTime: string;
  lastDirection: MessageDirection;
  lastStatus: DeliveryStatus;
  unread: number;
  favorite: boolean;
}
