import { UserRole } from '../../../core/models/auth.model';
import { APP_TIME_ZONE } from '../../../shared/pipes/cairo-date.pipe';
import {
  Announcement,
  AnnouncementPhase,
  AnnouncementTone,
} from '../models/announcement.models';

/**
 * Pure helpers for announcements — no Angular, no I/O, easy to unit-test.
 *
 * Dates are compared as `YYYY-MM-DD` strings in Cairo time: lexical order
 * equals chronological order for that format, and the business day is
 * Cairo's regardless of the viewer's device clock.
 */

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Cairo as `YYYY-MM-DD`. */
export function cairoToday(now: Date = new Date()): string {
  return DAY_FORMAT.format(now);
}

/** `YYYY-MM-DD` shifted by `days` (calendar arithmetic, timezone-free). */
export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Inclusive number of days in the window (1 for a single-day announcement). */
export function windowLength(startsOn: string, endsOn: string): number {
  const ms = Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Days left including today (0 once expired). */
export function daysLeft(a: Pick<Announcement, 'endsOn'>, today: string): number {
  if (today > a.endsOn) return 0;
  return windowLength(today, a.endsOn);
}

export function announcementPhase(
  a: Pick<Announcement, 'startsOn' | 'endsOn'>,
  today: string,
): AnnouncementPhase {
  if (today < a.startsOn) return 'scheduled';
  if (today > a.endsOn) return 'expired';
  return 'active';
}

/** Does this announcement target `role`? Admins see everything they publish. */
export function isTargeted(
  a: Pick<Announcement, 'audience' | 'roles'>,
  role: UserRole | null,
): boolean {
  if (!role) return false;
  if (role === 'Admin') return true;
  return a.audience === 'all' || (a.roles as string[]).includes(role);
}

/** Pinned first, then the most recently starting / created. */
export function compareAnnouncements(a: Announcement, b: Announcement): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

export const TONE_ICON: Record<AnnouncementTone, string> = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-bullhorn',
};
