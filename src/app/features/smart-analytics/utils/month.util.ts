import { APP_TIME_ZONE } from '../../../shared/pipes/cairo-date.pipe';
import { MonthKey } from '../models/smart-analytics.models';

/**
 * `YYYY-MM` month keys on the Cairo calendar. Lexical order equals
 * chronological order for this format, so plain string comparison works.
 */

const MONTH_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
});

export function cairoMonth(now: Date = new Date()): MonthKey {
  // en-CA formats year+month as `YYYY-MM`.
  return MONTH_FORMAT.format(now);
}

export function isMonthKey(value: string | null | undefined): value is MonthKey {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * How much of `month` has elapsed (0–1] on the Cairo calendar — `1` for
 * past months. Lets in-progress months be labelled (and mocked) honestly.
 */
export function monthProgress(month: MonthKey, now: Date = new Date()): number {
  const current = cairoMonth(now);
  if (month < current) return 1;
  if (month > current) return 0;
  return Number(DAY_FORMAT.format(now)) / daysInMonth(month);
}

/** "نوفمبر 2026" / "November 2026". */
export function monthLabel(month: MonthKey, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    numberingSystem: 'latn',
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}
