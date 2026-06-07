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

/**
 * Canonical keys — match the backend `CustomerStatus` enum:
 * New = 0, Negotiating = 1, Buyer = 2, NotBuyer = 3.
 * `none` is kept as a safe fallback for records with no status set.
 */
export type CustomerStatusKey =
  | 'new'
  | 'none'
  | 'negotiating'
  | 'buyer'
  | 'notBuyer';

interface StatusEntry {
  key: CustomerStatusKey;
  /** Lowercased English enum code as it appears in list responses. */
  code: string;
  /** Arabic display name as it appears in the `/statuses` dropdown. */
  arabic: string;
  english: string;
  badge: string;
  /** Exact enum name sent to `PUT /Customers/{id}/status` as `status`. */
  enumName: string;
}

const STATUSES: StatusEntry[] = [
  { key: 'new',        code: 'new',        arabic: 'جديد',         english: 'New',        badge: 'badge-status-new',          enumName: 'New' },
  { key: 'none',       code: 'none',       arabic: 'بدون حالة',    english: 'No status',  badge: 'badge-status-unknown',      enumName: '' },
  { key: 'negotiating',code: 'negotiating',arabic: 'تفاوض',        english: 'Negotiating',badge: 'badge-status-negotiating',  enumName: 'Negotiating' },
  { key: 'buyer',      code: 'buyer',      arabic: 'مشتري',        english: 'Buyer',      badge: 'badge-status-purchased',    enumName: 'Buyer' },
  { key: 'notBuyer',   code: 'notbuyer',   arabic: 'غير مشتري',    english: 'Not buyer',  badge: 'badge-status-lost',         enumName: 'NotBuyer' },
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

/**
 * Returns the exact enum name to send to `PUT /Customers/{id}/status`.
 * Example: Arabic "تفاوض" or English code "negotiating" → "Negotiating".
 * Returns null when the status is unknown or has no backend enum name.
 */
export function customerStatusEnumName(raw: string | null | undefined): string | null {
  const entry = findEntry(raw);
  if (!entry || !entry.enumName) return null;
  return entry.enumName;
}
