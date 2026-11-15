import { addDays, cairoToday } from '../../../core/utils/cairo-time.util';
import { extractCalendarDate } from '../../../core/utils/calendar-date.util';
import {
  ContractDetail,
  ContractListItem,
  ContractStatus,
  RENEWAL_NOTES_MAX,
  RenewContractRequest,
} from '../../../shared/models';
import { daysUntilEnd } from './contract-lifecycle.util';

/**
 * Renewal rules (`POST /Contracts/RenewContract/{id}`). Pure; all dates are
 * calendar days (`yyyy-MM-dd`, Cairo). The backend re-validates everything —
 * these only keep the dialog honest before the round-trip.
 */

/** Offer "Renew" on rows that expired or end within this many days. */
export const RENEW_PROMPT_DAYS = 30;

type ContractLike = Pick<ContractListItem, 'status' | 'endDate'>;

/** Cancelled contracts can't be renewed. */
export function canRenew(contract: Pick<ContractListItem, 'status'>): boolean {
  return contract.status !== 'Cancelled';
}

/** Rows that should surface a "Renew" action: expired, or ending within {@link RENEW_PROMPT_DAYS}. */
export function suggestsRenewal(contract: ContractLike, now = Date.now()): boolean {
  if (!canRenew(contract)) return false;
  if (contract.status === 'Expired') return true;
  const days = daysUntilEnd(contract.endDate, now);
  return days !== null && days <= RENEW_PROMPT_DAYS;
}

/** Row highlight for the contracts table. */
export function renewalUrgency(contract: ContractLike, now = Date.now()): 'expired' | 'expiring' | null {
  if (contract.status === 'Cancelled') return null;
  const days = daysUntilEnd(contract.endDate, now);
  if (contract.status === 'Expired' || (days !== null && days < 0)) return 'expired';
  return days !== null && days <= RENEW_PROMPT_DAYS ? 'expiring' : null;
}

/** `day` + `months`, clamped to the month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsToDay(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** The backend's default start: the day after the current end (today when open-ended). */
export function defaultRenewalStart(contract: Pick<ContractDetail, 'endDate'>, today = cairoToday()): string {
  const end = extractCalendarDate(contract.endDate);
  return end ? addDays(end, 1) : today;
}

/**
 * Quick picks extend from the current end date (so +1 year keeps the same
 * anniversary); an open-ended or long-expired contract extends from today.
 */
export function quickEndDate(contract: Pick<ContractDetail, 'endDate'>, months: number, today = cairoToday()): string {
  const end = extractCalendarDate(contract.endDate);
  const base = end && end >= today ? end : today;
  return addMonthsToDay(base, months);
}

export type RenewalError =
  | 'endRequired'
  | 'endNotAfterCurrent'
  | 'endInPast'
  | 'startAfterEnd'
  | 'negativePrice'
  | 'notesTooLong'
  | 'cancelled';

export interface RenewalDraft {
  newEndDate: string;
  newStartDate: string;
  newPrice: number | null;
  notes: string;
}

/** Same checks as the backend (its Arabic message still wins when they disagree). */
export function validateRenewal(
  contract: Pick<ContractDetail, 'status' | 'endDate'> & { status: ContractStatus },
  draft: RenewalDraft,
  today = cairoToday(),
): RenewalError[] {
  const errors: RenewalError[] = [];
  if (contract.status === 'Cancelled') errors.push('cancelled');
  const end = draft.newEndDate;
  if (!end) {
    errors.push('endRequired');
  } else {
    const currentEnd = extractCalendarDate(contract.endDate);
    if (currentEnd && end <= currentEnd) errors.push('endNotAfterCurrent');
    if (end < today) errors.push('endInPast');
    if (draft.newStartDate && draft.newStartDate > end) errors.push('startAfterEnd');
  }
  if (draft.newPrice !== null && draft.newPrice < 0) errors.push('negativePrice');
  if (draft.notes.length > RENEWAL_NOTES_MAX) errors.push('notesTooLong');
  return errors;
}

/** Body: omit what equals the backend default so the server stays the source of truth. */
export function buildRenewRequest(
  contract: Pick<ContractDetail, 'endDate' | 'price'>,
  draft: RenewalDraft,
  today = cairoToday(),
): RenewContractRequest {
  const body: RenewContractRequest = { newEndDate: draft.newEndDate };
  if (draft.newStartDate && draft.newStartDate !== defaultRenewalStart(contract, today)) body.newStartDate = draft.newStartDate;
  if (draft.newPrice !== null && draft.newPrice !== contract.price) body.newPrice = draft.newPrice;
  const notes = draft.notes.trim();
  if (notes) body.notes = notes;
  return body;
}

const DAY_FORMATS = new Map<string, Intl.DateTimeFormat>();

/** `2027-12-31` → "٣١ ديسمبر ٢٠٢٧" / "31 Dec 2027" — calendar day, no zone shift. */
export function formatContractDay(value: string | null | undefined, lang: 'ar' | 'en'): string | null {
  const day = extractCalendarDate(value);
  if (!day) return null;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  let fmt = DAY_FORMATS.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    DAY_FORMATS.set(locale, fmt);
  }
  const [y, m, d] = day.split('-').map(Number);
  return fmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/** Whole months between two calendar days (for "12 months" labels in the history). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(0, months);
}
