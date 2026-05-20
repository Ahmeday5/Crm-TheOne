import { Lang } from '../../../core/services/language.service';

/**
 * Localized display + theming for the customer-status field.
 *
 * Why this util exists:
 *  - The list endpoint (`Customers/getSalesCustomers`, `…/getLeadCustomer`)
 *    serializes the status as an English **enum code** like
 *    `AssignedToSalesTeam`.
 *  - The dropdown endpoint (`Customers/statuses`) serializes the same
 *    enum as an Arabic **display name** like `محول لفريق المبيعات`.
 *  - Older records sometimes also surface as `none` for "no status set".
 *
 * Anything not in the table falls back to the raw value so the UI stays
 * usable when the backend adds a status before the frontend catches up.
 */

/** Canonical keys — one per backend enum value. */
export type CustomerStatusKey =
  | 'new'
  | 'none'
  | 'negotiating'
  | 'buyer'
  | 'notBuyer'
  | 'assignedToSalesTeam'
  | 'contacted'
  | 'noAnswer'
  | 'noResponse'
  | 'quoteSent'
  | 'assignedToSupport'
  | 'transferredToSupport';

interface StatusEntry {
  key: CustomerStatusKey;
  /** Lowercased English enum code as it appears in list responses. */
  code: string;
  /** Arabic display name as it appears in the `/statuses` dropdown. */
  arabic: string;
  english: string;
  badge: string;
}

const STATUSES: StatusEntry[] = [
  { key: 'new',                 code: 'new',                 arabic: 'جديد',                  english: 'New',                badge: 'badge-status-new' },
  { key: 'none',                code: 'none',                arabic: 'بدون حالة',             english: 'No status',          badge: 'badge-status-unknown' },
  { key: 'negotiating',         code: 'negotiating',         arabic: 'تفاوض',                 english: 'Negotiating',        badge: 'badge-status-negotiating' },
  { key: 'buyer',               code: 'buyer',               arabic: 'مشتري',                 english: 'Buyer',              badge: 'badge-status-purchased' },
  { key: 'notBuyer',            code: 'notbuyer',            arabic: 'غير مشتري',             english: 'Not buyer',          badge: 'badge-status-lost' },
  { key: 'assignedToSalesTeam', code: 'assignedtosalesteam', arabic: 'محول لفريق المبيعات',   english: 'Assigned to sales',  badge: 'badge-status-default' },
  { key: 'contacted',           code: 'contacted',           arabic: 'تم التواصل',            english: 'Contacted',          badge: 'badge-status-default' },
  { key: 'noAnswer',            code: 'noanswer',            arabic: 'لا يرد',                english: 'No answer',          badge: 'badge-status-lost' },
  { key: 'noResponse',          code: 'noresponse',          arabic: 'لا يوجد رد',            english: 'No response',        badge: 'badge-status-lost' },
  { key: 'quoteSent',           code: 'quotesent',           arabic: 'تم إرسال عرض سعر',     english: 'Quote sent',         badge: 'badge-status-default' },
  { key: 'assignedToSupport',   code: 'assignedtosupport',   arabic: 'محول للدعم',            english: 'Assigned to support',badge: 'badge-status-default' },
  { key: 'transferredToSupport',code: 'transferredtosupport',arabic: 'محول للدعم الفني',      english: 'Transferred to support', badge: 'badge-status-default' },
];

const CODE_INDEX: Map<string, StatusEntry> = new Map(STATUSES.map((s) => [s.code, s]));
const NAME_INDEX: Map<string, StatusEntry> = new Map(STATUSES.map((s) => [s.arabic, s]));

/** Looks up a status entry by either the English enum code or the Arabic name. */
function findEntry(raw: string | null | undefined): StatusEntry | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const byName = NAME_INDEX.get(trimmed);
  if (byName) return byName;
  return CODE_INDEX.get(trimmed.toLowerCase()) ?? null;
}

/** Localized display name. Falls back to the raw value when unknown. */
export function resolveCustomerStatus(
  raw: string | null | undefined,
  lang: Lang,
  fallback = '',
): string {
  if (!raw) return fallback;
  const entry = findEntry(raw);
  if (!entry) return raw;
  return lang === 'ar' ? entry.arabic : entry.english;
}

/** Badge CSS class for the status pill. */
export function customerStatusBadgeClass(raw: string | null | undefined): string {
  const entry = findEntry(raw);
  return entry ? entry.badge : 'badge-status-default';
}

/**
 * Canonical key for a status string (English code or Arabic name).
 * Useful when comparing two status values that may have come from different
 * endpoints in different shapes.
 */
export function customerStatusKey(raw: string | null | undefined): CustomerStatusKey | null {
  return findEntry(raw)?.key ?? null;
}
