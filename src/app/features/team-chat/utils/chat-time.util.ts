import { Lang } from '../../../core/services/language.service';
import { APP_TIME_ZONE } from '../../../shared/pipes/cairo-date.pipe';

/** Pure date formatting for chat lists, separators and bubbles (Cairo time). */

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(lang: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: APP_TIME_ZONE });
    cache.set(key, f);
  }
  return f;
}

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(d);

function dayDiff(iso: string, now = new Date()): number {
  const a = Date.parse(`${dayKey(new Date(iso))}T00:00:00Z`);
  const b = Date.parse(`${dayKey(now)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatClock(iso: string, lang: Lang): string {
  return fmt(lang, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** List timestamp: time today, "yesterday", weekday this week, else a date. */
export function formatListTime(iso: string, lang: Lang, yesterday: string): string {
  const diff = dayDiff(iso);
  if (diff <= 0) return formatClock(iso, lang);
  if (diff === 1) return yesterday;
  if (diff < 7) return fmt(lang, { weekday: 'short' }).format(new Date(iso));
  return fmt(lang, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

/** Separator label between message days. */
export function formatDaySeparator(
  iso: string,
  lang: Lang,
  labels: { today: string; yesterday: string },
): string {
  const diff = dayDiff(iso);
  if (diff <= 0) return labels.today;
  if (diff === 1) return labels.yesterday;
  return fmt(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

/** "last seen 2h ago"-style relative time (minutes/hours/days). */
export function relativeSince(iso: string, lang: Lang): string {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en', { numeric: 'auto' });
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}
