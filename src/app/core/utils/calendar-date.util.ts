/**
 * Calendar-date helpers — operate on the **date portion** of an ISO string
 * without ever touching the host's local timezone.
 *
 * Why this exists: an `<input type="date">` yields a naive `YYYY-MM-DD`, and
 * the backend round-trips dates as either naive ISO (`2026-05-13T00:00:00`)
 * or UTC-anchored ISO (`2026-05-13T00:00:00Z`). Going through `new Date(…)
 * .toISOString()` silently rebases the value through the user's local zone,
 * which shifts the calendar day in any non-UTC timezone (e.g. Egypt UTC+2/+3
 * turns `2026-05-13` into `2026-05-12` on the wire).
 *
 * Treating the picked date as an opaque calendar value — never a moment in
 * time — keeps the day stable end-to-end. All daily-report / due-date style
 * fields should go through these helpers, not `Date.toISOString()`.
 */

/** Extracts `YYYY-MM-DD` from any ISO-ish string, ignoring time + zone. */
export function extractCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Converts a `YYYY-MM-DD` (from `<input type="date">`) to a UTC-anchored
 * ISO string the backend can parse without zone ambiguity:
 *
 *   '2026-05-13' → '2026-05-13T00:00:00.000Z'
 *
 * Falls back to "now" when the input is empty.
 */
export function calendarDateToIso(date: string | null | undefined): string {
  if (!date) return new Date().toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return new Date().toISOString();
  return `${date}T00:00:00.000Z`;
}

/**
 * Today's local calendar date as `YYYY-MM-DD`. Uses the host's local time —
 * not UTC — so users east of Greenwich shortly after midnight still see
 * the date they'd write on paper.
 */
export function localCalendarToday(): string {
  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Formats the date portion of an ISO value with the given locale, always in
 * UTC so the displayed day matches the stored calendar date regardless of
 * the viewer's timezone.
 */
export function formatCalendarDate(
  iso: string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const raw = extractCalendarDate(iso);
  if (!raw) return '-';
  const [y, m, d] = raw.split('-').map(Number);
  // Anchor at noon UTC — well clear of any DST edge cases.
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
}
