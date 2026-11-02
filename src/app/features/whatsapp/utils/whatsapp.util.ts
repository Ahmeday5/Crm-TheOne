import { ApiError } from '../../../core/models/api-response.model';
import { UserRole } from '../../../core/models/auth.model';
import { APP_TIME_ZONE, parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import {
  WhatsAppChat,
  WhatsAppInstanceStatus,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
  WhatsAppRecipient,
} from '../models/whatsapp.models';

/** Roles that chat with customers on WhatsApp inside the CRM. */
export const WHATSAPP_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

export function canUseWhatsApp(role: UserRole | null | undefined): boolean {
  return !!role && WHATSAPP_ROLES.includes(role);
}

// ─────────────── limits (mirrors the backend) ───────────────

/** `send-media` rejects anything larger. */
export const WHATSAPP_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** First page of a thread, and the step "show older" grows it by. */
export const WHATSAPP_TAKE_STEP = 50;
/** The messages endpoints cap `take` here. */
export const WHATSAPP_MAX_TAKE = 200;
/** Chat-list page size. */
export const WHATSAPP_CHATS_PAGE_SIZE = 20;

/** Polling cadence while there's no real-time channel yet. */
export const WHATSAPP_CHATS_POLL_MS = 15_000;
export const WHATSAPP_THREAD_POLL_MS = 5_000;

/** What the composer's file picker offers. */
export const WHATSAPP_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';

/** The backend's message when the caller has no number and no company default. */
const NO_NUMBER_ASSIGNED = /no whatsapp number is assigned/i;

// ─────────────── chats ───────────────

/** `+201012345678` — rendered `dir="ltr"`. */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D+/g, '');
  return digits ? `+${digits}` : '';
}

/** Customer name → WhatsApp profile name → `+phone`. */
export function chatDisplayName(chat: Pick<WhatsAppChat, 'customerName' | 'contactName' | 'phone'>): string {
  return chat.customerName?.trim() || chat.contactName?.trim() || formatWhatsAppPhone(chat.phone);
}

/** A registered customer is addressed by id; anyone else by phone. */
export function recipientForChat(chat: Pick<WhatsAppChat, 'customerId' | 'phone'>): WhatsAppRecipient {
  return chat.customerId ? { customerId: chat.customerId } : { phone: chat.phone };
}

// ─────────────── messages ───────────────

/** Rendering families — Wavex has a few aliases per family. */
export type WhatsAppMediaKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'other';

export function mediaKindOf(type: WhatsAppMessageType | null | undefined): WhatsAppMediaKind {
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

export const MEDIA_KIND_ICON: Record<Exclude<WhatsAppMediaKind, 'text'>, string> = {
  image: 'fa-regular fa-image',
  video: 'fa-solid fa-video',
  audio: 'fa-solid fa-microphone',
  document: 'fa-regular fa-file-lines',
  sticker: 'fa-regular fa-face-smile',
  location: 'fa-solid fa-location-dot',
  contact: 'fa-regular fa-address-card',
  other: 'fa-solid fa-paperclip',
};

export function isOutgoing(m: Pick<WhatsAppMessage, 'direction'>): boolean {
  return m.direction === 'Outgoing';
}

export interface MessageStatusMeta {
  icon: string;
  /** Modifier for `.wa-tick--*`. */
  tone: 'muted' | 'read' | 'danger';
  labelKey: string;
}

/** WhatsApp-style ticks for outgoing messages; `null` for incoming ones. */
export function messageStatusMeta(status: WhatsAppMessageStatus): MessageStatusMeta | null {
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

/** The message type a file will be sent as — used for the optimistic bubble. */
export function messageTypeForFile(file: File): WhatsAppMessageType {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export type AttachmentProblem = 'empty' | 'tooLarge';

export function validateAttachment(file: File): AttachmentProblem | null {
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

export interface MessageDayGroup<T extends WhatsAppMessage = WhatsAppMessage> {
  key: string;
  /** First message's timestamp — what the day separator formats. */
  date: string;
  messages: T[];
}

/** Splits an oldest → newest list into Cairo calendar days. */
export function groupMessagesByDay<T extends WhatsAppMessage>(messages: readonly T[]): MessageDayGroup<T>[] {
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

export type StatusTone = 'success' | 'warning' | 'danger' | 'gray';

export interface InstanceStatusMeta {
  tone: StatusTone;
  labelKey: string;
}

export function isNumberWorking(status: WhatsAppInstanceStatus | null | undefined): boolean {
  return status === 'WORKING';
}

/** Badge colour + label for a number's connection state. */
export function instanceStatusMeta(status: WhatsAppInstanceStatus | null | undefined): InstanceStatusMeta {
  switch (status) {
    case 'WORKING':
      return { tone: 'success', labelKey: 'whatsapp.instanceStatus.WORKING' };
    case 'QR_REQUIRED':
      return { tone: 'warning', labelKey: 'whatsapp.instanceStatus.QR_REQUIRED' };
    case 'CONNECTING':
    case 'INITIALIZING':
      return { tone: 'warning', labelKey: 'whatsapp.instanceStatus.CONNECTING' };
    case 'DISCONNECTED':
      return { tone: 'danger', labelKey: 'whatsapp.instanceStatus.DISCONNECTED' };
    case 'BANNED':
      return { tone: 'danger', labelKey: 'whatsapp.instanceStatus.BANNED' };
    default:
      return { tone: 'gray', labelKey: 'whatsapp.instanceStatus.unknown' };
  }
}

// ─────────────── errors ───────────────

/** 401 on these endpoints = "this customer / chat isn't yours". */
export function isPermissionError(err: unknown): boolean {
  return (err as ApiError | null)?.status === 401;
}

/** `GET /status` answers 400 when the caller has no number to send from. */
export function isNoNumberAssignedError(err: unknown): boolean {
  const e = err as ApiError | null;
  return e?.status === 400 && NO_NUMBER_ASSIGNED.test(e.message ?? '');
}

/**
 * User-facing text for a failed WhatsApp call: 401 → the permission message,
 * otherwise the server's own message (400s carry the reason), else `fallback`.
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
