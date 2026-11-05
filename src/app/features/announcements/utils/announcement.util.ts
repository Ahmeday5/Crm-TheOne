import { inclusiveDays } from '../../../core/utils/cairo-time.util';
import { Announcement, AnnouncementPhase } from '../models/announcement.models';

/**
 * Pure helpers for announcements — no Angular, no I/O, easy to unit-test.
 * Days are `YYYY-MM-DD` Cairo strings (lexical order = chronological order).
 */

/** Inclusive number of days in the window (1 for a single-day announcement). */
export function windowLength(startsOn: string, endsOn: string): number {
  return Math.max(1, inclusiveDays(startsOn, endsOn));
}

/** Days left including today (0 once expired). */
export function daysLeft(a: Pick<Announcement, 'endsOn'>, today: string): number {
  return today > a.endsOn ? 0 : inclusiveDays(today, a.endsOn);
}

/**
 * The server's `isActive` wins for "live"; dates only tell a not-live
 * announcement apart as upcoming vs. finished.
 */
export function announcementPhase(
  a: Pick<Announcement, 'startsOn' | 'isActive'>,
  today: string,
): AnnouncementPhase {
  if (a.isActive) return 'active';
  return today < a.startsOn ? 'scheduled' : 'expired';
}

/** Is `today` inside the inclusive window? (Used for live hub events.) */
export function coversDay(a: Pick<Announcement, 'startsOn' | 'endsOn'>, today: string): boolean {
  return a.startsOn <= today && today <= a.endsOn;
}

/** Pinned first, then the most recently starting / created. */
export function compareAnnouncements(a: Announcement, b: Announcement): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/** Case-insensitive match on title / body (mirrors the server `search`). */
export function matchesSearch(a: Pick<Announcement, 'title' | 'body'>, term: string): boolean {
  const q = term.trim().toLowerCase();
  return !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
}

/** Visual accent: pinned posts stand out, everything else uses the brand tone. */
export function announcementTone(a: Pick<Announcement, 'isPinned'>): 'warning' | 'info' {
  return a.isPinned ? 'warning' : 'info';
}

export function announcementIcon(a: Pick<Announcement, 'isPinned'>): string {
  return a.isPinned ? 'fa-solid fa-thumbtack' : 'fa-solid fa-bullhorn';
}

/** i18n key of a target ("All employees" for `null`). */
export function targetLabelKey(target: string | null): string {
  return target ? `announcements.targets.${target}` : 'announcements.targets.all';
}

/** Insert or replace by id (immutable). */
export function upsertById(list: ReadonlyArray<Announcement>, item: Announcement): Announcement[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [item, ...list];
}
