import {
  addDays,
  addMonths,
  cairoToday,
  firstDayOfMonth,
  lastDayOfMonth,
  monthOf,
} from './cairo-time.util';

/**
 * Calendar-day range filters (`From` / `To` as `yyyy-MM-dd`).
 *
 * Pure helpers — no Angular, no I/O. Days are Cairo calendar days (the
 * business day), so "today" / "this month" match what the team sees on the
 * wall clock regardless of the viewer's device zone.
 *
 * Contract with the API:
 *   - both bounds optional, sent without a time;
 *   - `To` is inclusive (the server extends it to the end of that day);
 *   - `From > To` is rejected with a 400, so the UI never emits it;
 *   - empty bounds are omitted from the query, never sent as `''` / `null`.
 */
export interface DateRangeValue {
  /** `yyyy-MM-dd`, inclusive. */
  from?: string;
  /** `yyyy-MM-dd`, inclusive (end of day on the server). */
  to?: string;
}

export type DateRangePreset =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear';

/** The presets the customer screens offer by default. */
export const DEFAULT_DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  'today',
  'last7Days',
  'thisMonth',
  'lastMonth',
];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real `yyyy-MM-dd` calendar day (rejects `2026-02-31`). */
export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !DAY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Keeps only valid bounds — an empty object means "no date filter". */
export function normalizeDateRange(range: DateRangeValue | null | undefined): DateRangeValue {
  const out: DateRangeValue = {};
  if (isIsoDay(range?.from)) out.from = range!.from;
  if (isIsoDay(range?.to)) out.to = range!.to;
  return out;
}

export function isDateRangeActive(range: DateRangeValue | null | undefined): boolean {
  const r = normalizeDateRange(range);
  return !!(r.from || r.to);
}

/** `From` after `To` — the one shape the API rejects. ISO days compare lexically. */
export function isDateRangeInverted(range: DateRangeValue | null | undefined): boolean {
  const r = normalizeDateRange(range);
  return !!(r.from && r.to && r.from > r.to);
}

export function sameDateRange(a: DateRangeValue | null | undefined, b: DateRangeValue | null | undefined): boolean {
  const x = normalizeDateRange(a);
  const y = normalizeDateRange(b);
  return x.from === y.from && x.to === y.to;
}

/**
 * Query params for the API: `{ From, To }` with empty bounds dropped, so a
 * spread into a query object never sends an empty param.
 */
export function toDateRangeParams(range: DateRangeValue | null | undefined): { From?: string; To?: string } {
  const r = normalizeDateRange(range);
  const params: { From?: string; To?: string } = {};
  if (r.from) params.From = r.from;
  if (r.to) params.To = r.to;
  return params;
}

/** The concrete days a preset covers, relative to `today` (Cairo). */
export function presetDateRange(preset: DateRangePreset, today: string = cairoToday()): Required<DateRangeValue> {
  const month = monthOf(today);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'last7Days':
      return { from: addDays(today, -6), to: today };
    case 'last30Days':
      return { from: addDays(today, -29), to: today };
    case 'last90Days':
      return { from: addDays(today, -89), to: today };
    case 'thisMonth':
      return { from: firstDayOfMonth(month), to: today };
    case 'lastMonth': {
      const prev = addMonths(month, -1);
      return { from: firstDayOfMonth(prev), to: lastDayOfMonth(prev) };
    }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Which of `presets` exactly matches `range` (to highlight its chip), if any. */
export function matchDateRangePreset(
  range: DateRangeValue | null | undefined,
  presets: readonly DateRangePreset[],
  today: string = cairoToday(),
): DateRangePreset | null {
  if (!isDateRangeActive(range)) return null;
  return presets.find((p) => sameDateRange(presetDateRange(p, today), range)) ?? null;
}

/**
 * Reads a range from URL query params (`?from=…&to=…`). Invalid or inverted
 * values are dropped instead of being forwarded to the API as a 400.
 */
export function dateRangeFromParams(from: string | null, to: string | null): DateRangeValue {
  const range = normalizeDateRange({ from: from ?? undefined, to: to ?? undefined });
  return isDateRangeInverted(range) ? {} : range;
}
