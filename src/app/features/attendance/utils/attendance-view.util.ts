import { APP_TIME_ZONE } from '../../../shared/pipes/cairo-date.pipe';
import { AttendanceDay, DayStatus, PresenceState } from '../models/attendance.models';

/**
 * Pure presentation helpers shared by the calendar, the day table and the
 * team matrix (icons, tooltips). Translation is injected as a function so
 * this stays framework-free.
 */

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export const DAY_STATUS_ICON: Record<DayStatus, string> = {
  present: 'fa-solid fa-check',
  late: 'fa-solid fa-clock',
  absent: 'fa-solid fa-xmark',
  leave: 'fa-solid fa-umbrella-beach',
  weekend: 'fa-solid fa-mug-saucer',
  holiday: 'fa-solid fa-flag',
  pending: 'fa-solid fa-hourglass-start',
  upcoming: 'fa-regular fa-circle',
};

export const PRESENCE_ICON: Record<PresenceState, string> = {
  working: 'fa-solid fa-laptop',
  done: 'fa-solid fa-house-chimney',
  notYet: 'fa-solid fa-hourglass-start',
  absent: 'fa-solid fa-user-xmark',
  leave: 'fa-solid fa-umbrella-beach',
  off: 'fa-solid fa-mug-saucer',
};

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** Cairo wall-clock time of an instant ("9:04 ص" / "09:04"). */
export function formatTime(iso: string, locale: string): string {
  let f = timeFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
    timeFormatters.set(locale, f);
  }
  return f.format(new Date(iso));
}

/** One-line description of a day for tooltips ("متأخر 20 د · 9:20 ص – 5:10 م"). */
export function dayTooltip(day: AttendanceDay, lang: 'ar' | 'en', locale: string, t: Translate): string {
  const parts: string[] = [t(`attendance.status.${day.status}`)];
  if (day.holidayName) parts[0] = `${parts[0]}: ${day.holidayName[lang]}`;
  if (day.leave) {
    parts.push(t(`attendance.leaveTypes.${day.leave.type}`) + (day.leave.halfDay ? ` (${t('attendance.leave.halfDay')})` : ''));
  }
  if (day.lateMinutes > 0) parts.push(t('attendance.clock.late', { m: day.lateMinutes }));
  if (day.checkIn) {
    const out = day.checkOut ? formatTime(day.checkOut, locale) : '…';
    parts.push(`${formatTime(day.checkIn, locale)} – ${out}`);
  }
  if (day.isExtra) parts.push(t('attendance.log.extra'));
  return parts.join(' · ');
}
