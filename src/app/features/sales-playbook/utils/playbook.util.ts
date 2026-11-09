import { PlaybookKind } from '../models/sales-playbook.models';
import { normalizeText } from './arabic-text.util';

/** Presentation constants + small pure helpers shared by the playbook UI. */

export const KIND_ICON: Record<PlaybookKind, string> = {
  scripts: 'fa-solid fa-headset',
  objections: 'fa-solid fa-shield-halved',
  competitors: 'fa-solid fa-chess-knight',
  replies: 'fa-solid fa-bolt',
};

export type PlaybookTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface CategoryMeta {
  icon: string;
  tone: PlaybookTone;
}

// ─────────── categories (free text from the backend) ───────────

/**
 * Categories are free text owned by the data, so the UI never lists them —
 * it only *decorates* them. Each rule matches words (normalised Arabic or
 * English) and picks an icon + tone; anything unknown gets the neutral look.
 */
const CATEGORY_RULES: ReadonlyArray<{ words: readonly string[]; meta: CategoryMeta }> = [
  // objections
  { words: ['سعر', 'غالي', 'تكلفه', 'ميزانيه', 'price', 'cost', 'budget'], meta: { icon: 'fa-solid fa-tag', tone: 'danger' } },
  { words: ['توقيت', 'تاجيل', 'وقت', 'بعدين', 'timing', 'later', 'delay'], meta: { icon: 'fa-regular fa-clock', tone: 'warning' } },
  { words: ['ثقه', 'trust', 'ضمان'], meta: { icon: 'fa-solid fa-handshake', tone: 'info' } },
  { words: ['منافس', 'competitor', 'بديل'], meta: { icon: 'fa-solid fa-chess-knight', tone: 'primary' } },
  { words: ['احتياج', 'حاجه', 'need'], meta: { icon: 'fa-solid fa-circle-question', tone: 'success' } },
  { words: ['قرار', 'مدير', 'decision'], meta: { icon: 'fa-solid fa-user-tie', tone: 'warning' } },
  // quick replies
  { words: ['ترحيب', 'اهلا', 'greeting', 'welcome'], meta: { icon: 'fa-regular fa-hand', tone: 'success' } },
  { words: ['عرض', 'quote', 'offer'], meta: { icon: 'fa-solid fa-file-invoice-dollar', tone: 'primary' } },
  { words: ['ديمو', 'demo', 'تجربه'], meta: { icon: 'fa-solid fa-display', tone: 'info' } },
  { words: ['متابعه', 'follow'], meta: { icon: 'fa-solid fa-rotate', tone: 'warning' } },
  { words: ['اغلاق', 'حجز', 'closing', 'close'], meta: { icon: 'fa-solid fa-flag-checkered', tone: 'primary' } },
  { words: ['دعم', 'support', 'مشكله'], meta: { icon: 'fa-solid fa-life-ring', tone: 'danger' } },
  { words: ['معلومات', 'info', 'تفاصيل'], meta: { icon: 'fa-solid fa-circle-info', tone: 'info' } },
];

const DEFAULT_CATEGORY_META: CategoryMeta = { icon: 'fa-solid fa-tag', tone: 'info' };

export function categoryMeta(category: string | null | undefined): CategoryMeta {
  const text = normalizeText(category);
  if (!text) return DEFAULT_CATEGORY_META;
  return CATEGORY_RULES.find((r) => r.words.some((w) => text.includes(w)))?.meta ?? DEFAULT_CATEGORY_META;
}

/** Distinct non-empty categories, sorted (Arabic-aware), with how many items use each. */
export function categoryCounts(values: ReadonlyArray<string | null>): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of values) {
    const c = v?.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category, 'ar'));
}

// ─────────── quick-reply placeholders ───────────

/** Tokens the backend's `Render` endpoint understands. */
export const CUSTOMER_NAME_TOKEN = '{{customerName}}';
export const AGENT_NAME_TOKEN = '{{agentName}}';

const CUSTOMER_PLACEHOLDER = /\{\{\s*customerName\s*\}\}/gi;
const AGENT_PLACEHOLDER = /\{\{\s*agentName\s*\}\}/gi;
/** Spellings used before the backend existed (`{name}`, `{الاسم}`…). */
const LEGACY_NAME_PLACEHOLDER = /\{\s*(?:name|الاسم|اسم_العميل)\s*\}/gi;

/** Rewrites legacy `{name}` tokens to `{{customerName}}`. */
export function normalizePlaceholders(text: string): string {
  return text.replace(LEGACY_NAME_PLACEHOLDER, CUSTOMER_NAME_TOKEN);
}

/** Is the reply personalised (contains any name placeholder)? */
export function hasNamePlaceholder(text: string): boolean {
  return [CUSTOMER_PLACEHOLDER, AGENT_PLACEHOLDER, LEGACY_NAME_PLACEHOLDER].some((re) => {
    re.lastIndex = 0;
    const found = re.test(text);
    re.lastIndex = 0;
    return found;
  });
}

export interface ReplyPlaceholderValues {
  /** Customer's name — `{{customerName}}`. */
  name?: string | null;
  /** Signed-in rep — `{{agentName}}`. */
  agent?: string | null;
}

/**
 * Fills the placeholders locally (same rules as the backend's `Render`).
 * A value that's unknown leaves its token untouched, so the rep notices it
 * and types the name in themselves.
 */
export function fillReplyPlaceholders(text: string, values: ReplyPlaceholderValues): string {
  const name = values.name?.trim();
  const agent = values.agent?.trim();
  let out = normalizePlaceholders(text);
  if (name) out = out.replace(CUSTOMER_PLACEHOLDER, name);
  if (agent) out = out.replace(AGENT_PLACEHOLDER, agent);
  return out;
}

// ─────────── misc ───────────

/** "a\n b \n\n c" → ["a", "b", "c"]. */
export function cleanLines(items: readonly string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

/** Initials for an avatar ("Ahmed Ali" → "AA", "محمد" → "م"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
