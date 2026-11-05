import { APP_TIME_ZONE } from '../../../shared/pipes/cairo-date.pipe';

/**
 * Pure calendar / clock helpers — no Angular, no I/O.
 *
 * Two representations are used everywhere:
 *  - a calendar day is `YYYY-MM-DD` and a month is `YYYY-MM` (lexical order
 *    equals chronological order, arithmetic is done in UTC so it never
 *    drifts with DST);
 *  - an instant is a UTC ISO-8601 string, read as Cairo wall-clock time.
 */

const DAY_MS = 86_400_000;

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of PARTS_FORMAT.formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p['year'],
    month: +p['month'],
    day: +p['day'],
    hour: +p['hour'] % 24,
    minute: +p['minute'],
    second: +p['second'],
  };
}

/** Cairo's UTC offset (minutes) at `date` — +120 in winter, +180 in summer. */
function cairoOffsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - wholeSeconds) / 60_000);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

// ─────────────────────────── instants ───────────────────────────

/** Today's date in Cairo as `YYYY-MM-DD`. */
export function cairoToday(now: Date = new Date()): string {
  return DAY_FORMAT.format(now);
}

/** Cairo calendar day of an instant. */
export function cairoDayOf(value: string | Date): string {
  return DAY_FORMAT.format(toDate(value));
}

/** Cairo wall-clock minutes after midnight of an instant (0–1439). */
export function cairoMinutesOf(value: string | Date): number {
  const p = zonedParts(toDate(value));
  return p.hour * 60 + p.minute;
}

/** Cairo wall-clock seconds after midnight of an instant. */
export function cairoSecondsOf(value: string | Date): number {
  const p = zonedParts(toDate(value));
  return p.hour * 3600 + p.minute * 60 + p.second;
}

/** UTC ISO instant for a Cairo wall-clock time on a Cairo day. DST-safe. */
export function cairoTimeToIso(day: string, minutes: number, seconds = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes, seconds);
  const first = cairoOffsetMinutes(new Date(naive - 2 * 3_600_000));
  let ts = naive - first * 60_000;
  const second = cairoOffsetMinutes(new Date(ts));
  if (second !== first) ts = naive - second * 60_000;
  return new Date(ts).toISOString();
}

/** Whole minutes between two instants (never negative). */
export function minutesBetween(from: string | Date, to: string | Date): number {
  return Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 60_000));
}

/** Whole seconds between two instants (never negative). */
export function secondsBetween(from: string | Date, to: string | Date): number {
  return Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 1000));
}

// ─────────────────────────── calendar days ───────────────────────────

function dayToUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** `YYYY-MM-DD` shifted by `days`. */
export function addDays(day: string, days: number): string {
  return new Date(dayToUtc(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, of the calendar date itself. */
export function weekdayOf(day: string): number {
  return new Date(dayToUtc(day)).getUTCDay();
}

/** Every day from `from` to `to`, both inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Do the inclusive ranges [aFrom, aTo] and [bFrom, bTo] share a day? */
export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

// ─────────────────────────── months ───────────────────────────

/** `YYYY-MM` of a day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function lastDayOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** Every day of a month. */
export function monthDays(month: string): string[] {
  return eachDay(firstDayOfMonth(month), lastDayOfMonth(month));
}

/** Months from `a` to `b` (positive when `b` is later). */
export function diffMonths(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

// ─────────────────────────── display ───────────────────────────

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${key}`;
  let f = formatterCache.get(cacheKey);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(cacheKey, f);
  }
  return f;
}

export function localeFor(lang: 'ar' | 'en'): string {
  return lang === 'ar' ? 'ar-EG' : 'en-GB';
}

/** "نوفمبر ٢٠٢٦" / "November 2026". */
export function formatMonthLabel(month: string, locale: string): string {
  return formatter('month', locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(dayToUtc(firstDayOfMonth(month))),
  );
}

/** Short weekday name of a calendar day ("السبت" / "Sat"). */
export function formatWeekday(day: string, locale: string, style: 'narrow' | 'short' | 'long' = 'short'): string {
  return formatter(`wd-${style}`, locale, { timeZone: 'UTC', weekday: style }).format(
    new Date(dayToUtc(day)),
  );
}

/** "الخميس، ٥ نوفمبر" / "Thursday, 5 November" for a calendar day. */
export function formatLongDay(day: string, locale: string): string {
  return formatter('long-day', locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(dayToUtc(day)));
}

/** "٥ نوفمبر" / "5 Nov" for a calendar day. */
export function formatShortDay(day: string, locale: string): string {
  return formatter('short-day', locale, { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(
    new Date(dayToUtc(day)),
  );
}

/** Live clock parts in Cairo for the hero card. */
export function formatClock(now: Date, locale: string): { time: string; seconds: string; period: string } {
  const parts = formatter('clock', locale, {
    timeZone: APP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    time: `${get('hour')}:${get('minute')}`,
    seconds: get('second'),
    period: get('dayPeriod'),
  };
}

/** "09:00" style label for Cairo minutes after midnight, localised digits. */
export function formatMinutesOfDay(minutes: number, locale: string): string {
  const iso = new Date(Date.UTC(2000, 0, 1, 0, Math.round(minutes))).toISOString();
  return formatter('mod', locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/** `HH:MM:SS` for an elapsed number of seconds (Latin digits — monospace timer). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
