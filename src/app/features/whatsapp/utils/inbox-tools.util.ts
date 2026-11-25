import { parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import { WaChat, WaChatLabel } from '../models/whatsapp.models';

/**
 * Inbox v4 chat tools (`docs/backend-prompt-inbox-v4.md` §2–§6): labels,
 * internal notes, reminders, "awaiting reply" and transfer — pure helpers
 * shared by the list, the toolbar and the customer panel.
 */

/** Solid status tone of a label chip (brand / status tokens only — no gradients). */
export type LabelTone = 'info' | 'brand' | 'warning' | 'success' | 'neutral';

export interface ChatLabelMeta {
  code: WaChatLabel;
  /** `inboxTools.labels.<code>` */
  key: string;
  icon: string;
  tone: LabelTone;
}

/** The fixed set (§2), in the order the UI offers them. */
export const CHAT_LABELS: readonly ChatLabelMeta[] = [
  { code: 'Interested', key: 'inboxTools.labels.Interested', icon: 'fa-solid fa-star', tone: 'info' },
  { code: 'QuoteSent', key: 'inboxTools.labels.QuoteSent', icon: 'fa-solid fa-file-invoice-dollar', tone: 'brand' },
  { code: 'AwaitingPayment', key: 'inboxTools.labels.AwaitingPayment', icon: 'fa-solid fa-hourglass-half', tone: 'warning' },
  { code: 'FollowUp', key: 'inboxTools.labels.FollowUp', icon: 'fa-solid fa-phone-volume', tone: 'success' },
  { code: 'Closed', key: 'inboxTools.labels.Closed', icon: 'fa-solid fa-circle-check', tone: 'neutral' },
];

const LABEL_INDEX = new Map(CHAT_LABELS.map((l) => [l.code, l]));

export function labelMeta(code: WaChatLabel): ChatLabelMeta {
  return LABEL_INDEX.get(code) ?? CHAT_LABELS[0];
}

/** `AwaitingReplyThresholdMinutes` until the server's counters say otherwise (§5). */
export const DEFAULT_AWAITING_THRESHOLD_MIN = 60;

/** Re-evaluate "waiting since …" and "reminder due" this often. */
export const INBOX_TOOLS_CLOCK_MS = 15_000;

/**
 * Has the chat's reminder time come? The server's `reminderDue` is a snapshot
 * from when the chat was loaded — the clock decides from then on, so a chat
 * turns "due" on screen the moment its time passes.
 */
export function isReminderDue(chat: Pick<WaChat, 'reminderDue' | 'nextReminderAt'>, now: number): boolean {
  if (chat.reminderDue) return true;
  const at = parseUtc(chat.nextReminderAt ?? null)?.getTime();
  return at !== undefined && at <= now;
}


export const NOTE_MAX_LENGTH = 1000;
export const REMINDER_NOTE_MAX_LENGTH = 300;

/** Minutes the customer has been waiting for our reply, or `null` when we spoke last. */
export function awaitingMinutes(chat: Pick<WaChat, 'awaitingReplySince'>, now: number): number | null {
  const since = parseUtc(chat.awaitingReplySince ?? null);
  if (!since) return null;
  return Math.max(0, Math.floor((now - since.getTime()) / 60_000));
}

/** Waiting longer than the threshold → red bar + "مستني من …" badge. */
export function isAwaitingReply(chat: Pick<WaChat, 'awaitingReplySince'>, thresholdMin: number, now: number): boolean {
  const minutes = awaitingMinutes(chat, now);
  return minutes !== null && minutes >= thresholdMin;
}

/** A wait split for display: `{ d, h, m }` — the template picks the largest unit(s). */
export interface WaitParts {
  d: number;
  h: number;
  m: number;
}

export function waitParts(minutes: number): WaitParts {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return { d, h, m: minutes % 60 };
}

/** Earliest first; chats without the field last. */
export function compareByIso(a: string | null | undefined, b: string | null | undefined): number {
  const at = parseUtc(a ?? null)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = parseUtc(b ?? null)?.getTime() ?? Number.POSITIVE_INFINITY;
  return at === bt ? 0 : at < bt ? -1 : 1;
}

// ─────────────── reminder presets («ذكّرني») ───────────────

export type ReminderPreset = 'in1h' | 'in3h' | 'tomorrow10' | 'nextWeek';
export const REMINDER_PRESETS: readonly ReminderPreset[] = ['in1h', 'in3h', 'tomorrow10', 'nextWeek'];

/**
 * The moment a preset stands for. "Tomorrow 10 AM" is the browser's local
 * 10:00 — the CRM is used in Egypt, and the datetime input is local too.
 */
export function presetDate(preset: ReminderPreset, now = new Date()): Date {
  switch (preset) {
    case 'in1h':
      return new Date(now.getTime() + 3_600_000);
    case 'in3h':
      return new Date(now.getTime() + 3 * 3_600_000);
    case 'tomorrow10': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    }
    case 'nextWeek':
      return new Date(now.getTime() + 7 * 86_400_000);
  }
}

// ─────────────── tiny localStorage helpers (never throw) ───────────────

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the preference just isn't remembered */
  }
}
