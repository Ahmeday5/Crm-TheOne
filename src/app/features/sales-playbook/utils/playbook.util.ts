import { ObjectionCategory, PlaybookKind, ReplyCategory } from '../models/sales-playbook.models';

/** Presentation constants + small pure helpers shared by the playbook UI. */

export const KIND_ICON: Record<PlaybookKind, string> = {
  scripts: 'fa-solid fa-headset',
  objections: 'fa-solid fa-shield-halved',
  competitors: 'fa-solid fa-chess-knight',
  replies: 'fa-solid fa-bolt',
};

export type PlaybookTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const OBJECTION_META: Record<ObjectionCategory, { icon: string; tone: PlaybookTone }> = {
  price: { icon: 'fa-solid fa-tag', tone: 'danger' },
  timing: { icon: 'fa-regular fa-clock', tone: 'warning' },
  trust: { icon: 'fa-solid fa-handshake', tone: 'info' },
  competitor: { icon: 'fa-solid fa-chess-knight', tone: 'primary' },
  need: { icon: 'fa-solid fa-circle-question', tone: 'success' },
  decisionMaker: { icon: 'fa-solid fa-user-tie', tone: 'warning' },
  other: { icon: 'fa-solid fa-ellipsis', tone: 'info' },
};

export const REPLY_META: Record<ReplyCategory, { icon: string; tone: PlaybookTone }> = {
  greeting: { icon: 'fa-regular fa-hand', tone: 'success' },
  info: { icon: 'fa-solid fa-circle-info', tone: 'info' },
  followUp: { icon: 'fa-solid fa-rotate', tone: 'warning' },
  closing: { icon: 'fa-solid fa-flag-checkered', tone: 'primary' },
  support: { icon: 'fa-solid fa-life-ring', tone: 'danger' },
  other: { icon: 'fa-solid fa-ellipsis', tone: 'info' },
};

/** Recognised spellings of the customer-name placeholder. */
const NAME_PLACEHOLDER = /\{\s*(?:name|الاسم|اسم_العميل)\s*\}/gi;

/** Does the reply contain `{name}`? */
export function hasNamePlaceholder(text: string): boolean {
  NAME_PLACEHOLDER.lastIndex = 0;
  const found = NAME_PLACEHOLDER.test(text);
  NAME_PLACEHOLDER.lastIndex = 0;
  return found;
}

/**
 * Fills `{name}` with the customer's name. Without a name the placeholder
 * is left untouched, so the rep sees it and types the name in themselves.
 */
export function fillReplyPlaceholders(text: string, values: { name?: string | null }): string {
  const name = values.name?.trim();
  return name ? text.replace(NAME_PLACEHOLDER, name) : text;
}

/** "a\n b \n\n c" → ["a", "b", "c"]. */
export function cleanLines(items: readonly string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Initials for a mention avatar ("Ahmed Ali" → "AA", "محمد" → "م"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
