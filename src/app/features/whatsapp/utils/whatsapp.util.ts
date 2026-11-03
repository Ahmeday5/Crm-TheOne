import { ApiError } from '../../../core/models/api-response.model';
import { UserRole } from '../../../core/models/auth.model';
import { APP_TIME_ZONE, parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import {
  WaChat,
  WaInstance,
  WaInstanceStatus,
  WaMessage,
  WaMessageStatus,
  WaMessageType,
  WaNumberStatus,
} from '../models/whatsapp.models';

/** Roles that chat with customers on WhatsApp inside the CRM. */
export const WHATSAPP_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

export function canUseWhatsApp(role: UserRole | null | undefined): boolean {
  return !!role && WHATSAPP_ROLES.includes(role);
}

// ─────────────── limits (mirror the backend) ───────────────

/** `send-media` rejects anything larger (3.5 MB). */
export const WHATSAPP_MAX_FILE_BYTES = 3.5 * 1024 * 1024;
export const WHATSAPP_MAX_TEXT_LENGTH = 4096;
export const WHATSAPP_MAX_CAPTION_LENGTH = 1024;
/** One page of a thread's history. */
export const WHATSAPP_MESSAGES_TAKE = 50;
/** The messages endpoints cap `take` here. */
export const WHATSAPP_MAX_TAKE = 200;
export const WHATSAPP_CHATS_PAGE_SIZE = 30;
export const WHATSAPP_SEARCH_DEBOUNCE_MS = 300;
/** Safety net while the real-time hub is down: re-read the visible data this often. */
export const WHATSAPP_FALLBACK_POLL_MS = 20_000;
/** The pairing dialog polls `GET /status` this often (alongside the hub event). */
export const WHATSAPP_PAIRING_POLL_MS = 5_000;

/** Extension → the family it is sent as. Everything else is rejected client-side. */
const ALLOWED_EXTENSIONS: Readonly<Record<string, 'image' | 'video' | 'document'>> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp4: 'video', '3gp': 'video',
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', txt: 'document', csv: 'document', zip: 'document',
  mp3: 'document', ogg: 'document', m4a: 'document',
};

/** What the composer's file picker offers. */
export const WHATSAPP_ACCEPT = Object.keys(ALLOWED_EXTENSIONS).map((ext) => `.${ext}`).join(',');
export const WHATSAPP_ALLOWED_EXTENSIONS_LABEL = Object.keys(ALLOWED_EXTENSIONS).join(', ');

// ─────────────── ids ───────────────

/**
 * A fresh idempotency key for one send. `crypto.randomUUID` needs a secure
 * context, so plain-http deployments fall back to `getRandomValues`.
 */
export function newClientMessageId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ─────────────── phones ───────────────

/** `+201012345678` — render with `dir="ltr"`. */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D+/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Normalises user input to `+<digits>` when it is a plausible international
 * number (8–15 digits, E.164), else `null`. A leading `00` counts as `+`.
 */
export function normalizeInternationalPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').trim().replace(/^00/, '').replace(/\D+/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/**
 * A number to message: international (`+201012345678`, 8–15 digits) → `+<digits>`,
 * or a local Egyptian number (`01012345678`) passed through as digits — the
 * backend accepts both. `null` when neither.
 */
export function normalizeRecipientPhone(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  const digits = value.replace(/\D+/g, '');
  if (!value.startsWith('+') && !value.startsWith('00') && /^0\d{9,10}$/.test(digits)) return digits;
  return normalizeInternationalPhone(value);
}

// ─────────────── chats ───────────────

/** Customer name → WhatsApp profile name → `+phone`. */
export function chatDisplayName(chat: Pick<WaChat, 'customerName' | 'contactName' | 'phone'>): string {
  return chat.customerName?.trim() || chat.contactName?.trim() || formatWhatsAppPhone(chat.phone);
}

/** Newest activity first, ties by id — the order `GET /chats` returns. */
export function compareChatsByActivity(a: WaChat, b: WaChat): number {
  const at = parseUtc(a.lastMessageAt)?.getTime() ?? 0;
  const bt = parseUtc(b.lastMessageAt)?.getTime() ?? 0;
  return bt - at || b.id - a.id;
}

// ─────────────── messages ───────────────

/** Rendering families — Wavex has a few aliases per family. */
export type WaMediaKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'other';

export function mediaKindOf(type: WaMessageType | null | undefined): WaMediaKind {
  switch ((type ?? 'text').toLowerCase()) {
    case 'text':
    case 'chat':
      return 'text';
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
    case 'ptt':
    case 'voice':
      return 'audio';
    case 'document':
    case 'file':
      return 'document';
    case 'sticker':
      return 'sticker';
    case 'location':
      return 'location';
    case 'contact':
    case 'vcard':
      return 'contact';
    default:
      return 'other';
  }
}

export const MEDIA_KIND_ICON: Record<Exclude<WaMediaKind, 'text'>, string> = {
  image: 'fa-regular fa-image',
  video: 'fa-solid fa-video',
  audio: 'fa-solid fa-microphone',
  document: 'fa-regular fa-file-lines',
  sticker: 'fa-regular fa-face-smile',
  location: 'fa-solid fa-location-dot',
  contact: 'fa-regular fa-address-card',
  other: 'fa-solid fa-paperclip',
};

export function isOutgoing(m: Pick<WaMessage, 'direction'>): boolean {
  return m.direction === 'Outgoing';
}

/**
 * Delivery progress only moves forward (Sent → Delivered → Read). `Failed`
 * may replace Pending / Sent, never a confirmed delivery.
 */
const STATUS_RANK: Readonly<Record<WaMessageStatus, number>> = {
  Pending: 0,
  Sent: 1,
  Failed: 1.5,
  Delivered: 2,
  Read: 3,
  Received: 3,
};

export function advanceStatus(current: WaMessageStatus, next: WaMessageStatus): WaMessageStatus {
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

export interface MessageStatusMeta {
  icon: string;
  /** Modifier for `.wa-tick--*`. */
  tone: 'muted' | 'read' | 'danger';
  labelKey: string;
}

/** WhatsApp-style ticks for outgoing messages; `null` for incoming ones. */
export function messageStatusMeta(status: WaMessageStatus): MessageStatusMeta | null {
  switch (status) {
    case 'Pending':
      return { icon: 'fa-regular fa-clock', tone: 'muted', labelKey: 'whatsapp.message.status.Pending' };
    case 'Sent':
      return { icon: 'fa-solid fa-check', tone: 'muted', labelKey: 'whatsapp.message.status.Sent' };
    case 'Delivered':
      return { icon: 'fa-solid fa-check-double', tone: 'muted', labelKey: 'whatsapp.message.status.Delivered' };
    case 'Read':
      return { icon: 'fa-solid fa-check-double', tone: 'read', labelKey: 'whatsapp.message.status.Read' };
    case 'Failed':
      return { icon: 'fa-solid fa-circle-exclamation', tone: 'danger', labelKey: 'whatsapp.message.status.Failed' };
    default:
      return null;
  }
}

// ─────────────── attachments ───────────────

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The message type a file will be sent as — used for the optimistic bubble. */
export function messageTypeForFile(file: File): WaMessageType {
  return ALLOWED_EXTENSIONS[fileExtension(file.name)] ?? 'document';
}

export type AttachmentProblem = 'empty' | 'tooLarge' | 'type';

export function validateAttachment(file: File): AttachmentProblem | null {
  if (!ALLOWED_EXTENSIONS[fileExtension(file.name)]) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > WHATSAPP_MAX_FILE_BYTES) return 'tooLarge';
  return null;
}

/** `1.4 MB` / `820 KB` — locale digits. */
export function formatBytes(bytes: number, lang: 'ar' | 'en'): string {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  const unit = (n: number, ar: string, en: string, digits: number) =>
    `${n.toLocaleString(locale, { maximumFractionDigits: digits })} ${lang === 'ar' ? ar : en}`;
  if (bytes >= 1024 * 1024) return unit(bytes / (1024 * 1024), 'ميجا', 'MB', 1);
  return unit(Math.max(1, Math.round(bytes / 1024)), 'كيلو', 'KB', 0);
}

// ─────────────── day grouping ───────────────

const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` of a UTC timestamp, in Cairo time. */
export function cairoDayKey(value: string | Date | null | undefined): string {
  const date = parseUtc(value);
  return date ? DAY_KEY_FORMAT.format(date) : '';
}

export interface MessageDayGroup<T extends WaMessage = WaMessage> {
  key: string;
  /** First message's timestamp — what the day separator formats. */
  date: string;
  messages: T[];
}

/** Splits an oldest → newest list into Cairo calendar days. */
export function groupMessagesByDay<T extends WaMessage>(messages: readonly T[]): MessageDayGroup<T>[] {
  const groups: MessageDayGroup<T>[] = [];
  for (const m of messages) {
    const key = cairoDayKey(m.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.messages.push(m);
    else groups.push({ key, date: m.sentAt, messages: [m] });
  }
  return groups;
}

/** `today` / `yesterday` relative to Cairo's calendar, else `null`. */
export function relativeDay(dayKey: string, now = new Date()): 'today' | 'yesterday' | null {
  if (dayKey === cairoDayKey(now)) return 'today';
  if (dayKey === cairoDayKey(new Date(now.getTime() - 86_400_000))) return 'yesterday';
  return null;
}

// ─────────────── numbers ───────────────

/** Status-dot colour: WORKING green, connecting amber, needs relink red, banned dark. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'dark' | 'gray';

export interface InstanceStatusMeta {
  tone: StatusTone;
  labelKey: string;
}

export function instanceStatusMeta(status: WaNumberStatus['status'] | null | undefined): InstanceStatusMeta {
  switch (status) {
    case 'WORKING':
      return { tone: 'success', labelKey: 'whatsapp.instanceStatus.WORKING' };
    case 'CONNECTING':
    case 'INITIALIZING':
      return { tone: 'warning', labelKey: 'whatsapp.instanceStatus.CONNECTING' };
    case 'QR_REQUIRED':
    case 'DISCONNECTED':
      return { tone: 'danger', labelKey: 'whatsapp.instanceStatus.DISCONNECTED' };
    case 'BANNED':
      return { tone: 'dark', labelKey: 'whatsapp.instanceStatus.BANNED' };
    case 'NOT_ASSIGNED':
      return { tone: 'gray', labelKey: 'whatsapp.instanceStatus.NOT_ASSIGNED' };
    default:
      return { tone: 'gray', labelKey: 'whatsapp.instanceStatus.UNKNOWN' };
  }
}

/** A channel the admin can still act on (it exists on the provider). */
export function isChannelActive(instance: Pick<WaInstance, 'existsInWavex'>): boolean {
  return instance.existsInWavex !== false;
}

/** The number can be (re)linked with a pairing code: present, not connected, not banned. */
export function canPair(instance: Pick<WaInstance, 'existsInWavex' | 'status' | 'canSend'>): boolean {
  return isChannelActive(instance) && !instance.canSend && instance.status !== 'BANNED';
}

// ─────────────── errors ───────────────

/**
 * 401 on these endpoints = "you don't have access" — never a logout (the
 * auth interceptor only lets a 401 through while the session is valid).
 */
export function isPermissionError(err: unknown): boolean {
  const status = (err as ApiError | null)?.status;
  return status === 401 || status === 403;
}

/** Outcome unknown (offline, gateway timeout…): the send may have gone out — retry with the same id. */
export function isTransientError(err: unknown): boolean {
  const status = (err as ApiError | null)?.status ?? 0;
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/** "already requested … try again in N seconds" → N, else `null`. */
export function retryAfterSeconds(err: unknown): number | null {
  const message = (err as ApiError | null)?.message ?? '';
  const match = /try again in\s+(\d+)\s*s/i.exec(message);
  return match ? Number(match[1]) : null;
}

/**
 * User-facing text for a failed WhatsApp call: permission → the shared
 * message, otherwise the server's own message (400s carry the reason),
 * else `fallbackKey`.
 */
export function whatsappErrorText(
  err: unknown,
  t: (key: string) => string,
  fallbackKey = 'whatsapp.errors.generic',
): string {
  if (isPermissionError(err)) return t('whatsapp.errors.noPermission');
  const message = (err as ApiError | null)?.message?.trim();
  return message || t(fallbackKey);
}
