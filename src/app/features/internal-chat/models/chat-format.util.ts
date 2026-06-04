/** Shared, locale-aware formatters for the chat UI. */

type ChatLocale = 'ar-EG' | 'en-US';

/** `14:32` style clock for a message timestamp. */
export function formatClock(ts: number, locale: ChatLocale): string {
  return new Date(ts).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Calendar key (`YYYY-MM-DD`, local) used to group messages into day blocks. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns 'today' | 'yesterday' | formatted date for a day separator. */
export function dayLabel(
  ts: number,
  locale: ChatLocale,
): { kind: 'today' | 'yesterday' | 'date'; date: string } {
  const today = new Date();
  const that = new Date(ts);
  const stripped = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((stripped(today) - stripped(that)) / 86_400_000);
  if (diffDays === 0) return { kind: 'today', date: '' };
  if (diffDays === 1) return { kind: 'yesterday', date: '' };
  return {
    kind: 'date',
    date: that.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

/** Compact relative/clock label for the conversation-list rows. */
export function listTimestamp(ts: number, locale: ChatLocale): string {
  const today = new Date();
  const that = new Date(ts);
  const sameDay =
    today.getFullYear() === that.getFullYear() &&
    today.getMonth() === that.getMonth() &&
    today.getDate() === that.getDate();
  if (sameDay) return formatClock(ts, locale);

  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(that.getFullYear(), that.getMonth(), that.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 1) return locale === 'ar-EG' ? 'أمس' : 'Yesterday';
  return that.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

/** `0:07` / `1:23` duration for voice notes and videos. */
export function formatDuration(sec: number | undefined): string {
  const total = Math.max(0, Math.round(sec ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Human file size for document bubbles. */
export function formatBytes(bytes: number | undefined): string {
  const b = bytes ?? 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
