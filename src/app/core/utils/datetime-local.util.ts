/**
 * Helpers for `<input type="datetime-local">`, whose value is a zone-less
 * local `yyyy-MM-ddTHH:mm` string.
 */

/** Local input value → ISO (UTC) string, or `null` when empty / invalid. */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Date → `yyyy-MM-ddTHH:mm` in the device's local time. */
export function toLocalInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}`
  );
}

/** Adds minutes to a local input value; returns `''` for an invalid input. */
export function addMinutesToLocalInput(value: string, minutes: number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalInputValue(new Date(d.getTime() + minutes * 60_000));
}
