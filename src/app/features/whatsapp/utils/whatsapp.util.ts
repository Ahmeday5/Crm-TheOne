import { ApiError } from '../../../core/models/api-response.model';
import { UserRole } from '../../../core/models/auth.model';
import { APP_TIME_ZONE, parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import {
  WaChannelType,
  WaChat,
  WaInstance,
  WaMessage,
  WaMessageStatus,
  WaMessageType,
  WaNumberStatus,
} from '../models/whatsapp.models';

/** Roles that chat with customers inside the CRM. */
export const WHATSAPP_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

export function canUseWhatsApp(role: UserRole | null | undefined): boolean {
  return !!role && WHATSAPP_ROLES.includes(role);
}

// ─────────────── limits (mirror the backend) ───────────────

/** `send-media` rejects anything larger (16 MB — the WhatsApp Cloud API limit). */
export const WHATSAPP_MAX_FILE_BYTES = 16 * 1024 * 1024;
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
/** `POST /import?max=` — conversations pulled from Mihwar per run. */
export const WHATSAPP_IMPORT_MAX = 100;

/** Extension → the family it is sent as. Everything else is rejected client-side. */
const ALLOWED_EXTENSIONS: Readonly<Record<string, 'image' | 'video' | 'audio' | 'document'>> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp4: 'video', '3gp': 'video',
  mp3: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', txt: 'document', csv: 'document', zip: 'document',
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

// ─────────────── channels ───────────────

export function isMessenger(subject: { channelType?: WaChannelType | null } | null | undefined): boolean {
  return subject?.channelType === 'messenger';
}

export function isWhatsAppChannel(channel: Pick<WaInstance, 'type'> | null | undefined): boolean {
  return channel?.type === 'whatsapp_cloud';
}

/** A channel the admin can still act on (it exists on the provider). */
export function isChannelActive(instance: Pick<WaInstance, 'existsInProvider'>): boolean {
  return instance.existsInProvider !== false;
}

/** Channel label: its name (Mihwar rarely returns the phone), else the phone, else the id. */
export function channelLabel(
  channel: Pick<WaInstance, 'id' | 'name' | 'phoneNumber'> | null | undefined,
): string {
  if (!channel) return '';
  return channel.name?.trim() || formatWhatsAppPhone(channel.phoneNumber) || `#${channel.id}`;
}

// ─────────────── chats ───────────────

/**
 * Customer name → contact name → `+phone`, else `null` (a Messenger user
 * without a name — the caller shows "Messenger customer").
 */
export function chatDisplayName(
  chat: Pick<WaChat, 'customerName' | 'contactName' | 'phone'>,
): string | null {
  return chat.customerName?.trim() || chat.contactName?.trim() || formatWhatsAppPhone(chat.phone) || null;
}

/**
 * Fills fields an older / partial backend build may omit, so the UI never
 * shows `undefined` or locks the composer by accident:
 * - `channelType` missing → Messenger chats have no phone, WhatsApp ones do;
 * - `canReply` missing → unknown window: let the user type (the backend has
 *   the final word and a refusal hands the draft back);
 * - `canSendTemplate` missing → WhatsApp only.
 */
export function normalizeChat(raw: WaChat): WaChat {
  const channelType: WaChannelType =
    raw.channelType === 'messenger' || raw.channelType === 'whatsapp_cloud'
      ? raw.channelType
      : raw.phone
        ? 'whatsapp_cloud'
        : 'messenger';
  return {
    ...raw,
    channelType,
    instanceName: raw.instanceName ?? null,
    canReply: raw.canReply ?? true,
    replyWindowEndsAt: raw.replyWindowEndsAt ?? null,
    canSendTemplate: raw.canSendTemplate ?? channelType === 'whatsapp_cloud',
  };
}

/** Same idea for channels: an unknown `type` is a WhatsApp number; missing `existsInProvider` = present. */
export function normalizeChannel(raw: WaInstance): WaInstance {
  return {
    ...raw,
    id: String(raw.id),
    type: raw.type === 'messenger' ? 'messenger' : 'whatsapp_cloud',
    existsInProvider: raw.existsInProvider ?? true,
  };
}

/** Newest activity first, ties by id — the order `GET /chats` returns. */
export function compareChatsByActivity(a: WaChat, b: WaChat): number {
  const at = parseUtc(a.lastMessageAt)?.getTime() ?? 0;
  const bt = parseUtc(b.lastMessageAt)?.getTime() ?? 0;
  return bt - at || b.id - a.id;
}

// ─────────────── messages ───────────────

/** Rendering families. */
export type WaMediaKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'template'
  | 'location'
  | 'reaction'
  | 'system'
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
    case 'template':
      return 'template';
    case 'location':
      return 'location';
    case 'reaction':
      return 'reaction';
    case 'system':
      return 'system';
    default:
      return 'other';
  }
}

/** Kinds shown as a small muted note instead of a full bubble. */
export function isNoteKind(kind: WaMediaKind): boolean {
  return kind === 'location' || kind === 'reaction' || kind === 'system';
}

export const MEDIA_KIND_ICON: Record<Exclude<WaMediaKind, 'text'>, string> = {
  image: 'fa-regular fa-image',
  video: 'fa-solid fa-video',
  audio: 'fa-solid fa-microphone',
  document: 'fa-regular fa-file-lines',
  sticker: 'fa-regular fa-face-smile',
  template: 'fa-solid fa-file-signature',
  location: 'fa-solid fa-location-dot',
  reaction: 'fa-regular fa-face-smile',
  system: 'fa-solid fa-circle-info',
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
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0) ? next : current;
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

export function validateAttachment(file: Pick<File, 'name' | 'size'>): AttachmentProblem | null {
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

// ─────────────── channel status ───────────────

/** Status colour: CONNECTED green, DISCONNECTED / INACTIVE red, unknown / none grey. */
export type StatusTone = 'success' | 'danger' | 'gray';

export interface InstanceStatusMeta {
  tone: StatusTone;
  labelKey: string;
}

export function instanceStatusMeta(status: WaNumberStatus['status'] | string | null | undefined): InstanceStatusMeta {
  switch (status) {
    case 'CONNECTED':
      return { tone: 'success', labelKey: 'whatsapp.instanceStatus.CONNECTED' };
    case 'DISCONNECTED':
      return { tone: 'danger', labelKey: 'whatsapp.instanceStatus.DISCONNECTED' };
    case 'INACTIVE':
      return { tone: 'danger', labelKey: 'whatsapp.instanceStatus.INACTIVE' };
    case 'NOT_ASSIGNED':
      return { tone: 'gray', labelKey: 'whatsapp.instanceStatus.NOT_ASSIGNED' };
    default:
      return { tone: 'gray', labelKey: 'whatsapp.instanceStatus.UNKNOWN' };
  }
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

/** A business-rule rejection (`400` with the reason in `message`) — nothing was sent. */
export function isRejection(err: unknown): boolean {
  const status = (err as ApiError | null)?.status ?? 0;
  return status === 400 || status === 404 || status === 409 || status === 413 || status === 422;
}

/**
 * User-facing text for a failed call: permission → the shared message,
 * otherwise the server's own message (400s carry the reason), else `fallbackKey`.
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
