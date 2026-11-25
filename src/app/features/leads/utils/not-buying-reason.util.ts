import { TRANSLATIONS, resolveKey } from '../../../core/i18n';

/**
 * Fixed "not buying" reasons — `PUT Customers/{id}/status` takes
 * `notBuyingReasonCode` (+ optional details, required for `Other`), and
 * `GET Sales/NotBuyingReasons` counts customers per code.
 */
export const NOT_BUYING_REASON_CODES = [
  'PriceTooHigh',
  'ChoseCompetitor',
  'BudgetTooLow',
  'NotNeededNow',
  'NoResponse',
  'Other',
] as const;

export type NotBuyingReasonCode = (typeof NOT_BUYING_REASON_CODES)[number];

/** One row of `GET Sales/NotBuyingReasons` — always all six codes, in order. */
export interface NotBuyingReasonCount {
  code: NotBuyingReasonCode;
  /** Server label (Arabic) — the UI prefers its own translation. */
  label: string;
  count: number;
}

export function isNotBuyingReasonCode(value: unknown): value is NotBuyingReasonCode {
  return typeof value === 'string' && (NOT_BUYING_REASON_CODES as readonly string[]).includes(value);
}

export function notBuyingReasonKey(code: NotBuyingReasonCode): string {
  return `customers.statusModal.reasons.${code}`;
}

/** `Other` needs details; every other code may add some. */
export function reasonNeedsDetails(code: NotBuyingReasonCode | null): boolean {
  return code === 'Other';
}

/** Body fields for the status change. */
export function notBuyingReasonPayload(
  code: NotBuyingReasonCode,
  details: string,
): { notBuyingReasonCode: NotBuyingReasonCode; notBuyingReason?: string } {
  const extra = details.trim();
  return extra ? { notBuyingReasonCode: code, notBuyingReason: extra } : { notBuyingReasonCode: code };
}

/**
 * Display text: "<reason> — <details>". `Other` shows the details alone
 * (that is the reason). Falls back to the raw text for rows without a code.
 */
export function formatNotBuyingReason(
  code: string | null | undefined,
  details: string | null | undefined,
  lang: 'ar' | 'en',
): string {
  const extra = (details ?? '').trim();
  if (!isNotBuyingReasonCode(code)) return extra;
  if (code === 'Other' && extra) return extra;
  const label = resolveKey(TRANSLATIONS[lang], notBuyingReasonKey(code));
  return extra ? `${label} — ${extra}` : label;
}
