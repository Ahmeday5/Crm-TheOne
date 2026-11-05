import { UserRole } from '../../../core/models/auth.model';

/**
 * Who an announcement targets: one department, or everyone (`null`).
 * Admin is a valid target too (e.g. a note for managers only).
 */
export type AnnouncementTarget = UserRole | null;

/** Dropdown order of the composer ("All employees" first). */
export const ANNOUNCEMENT_TARGETS: ReadonlyArray<AnnouncementTarget> = [
  null,
  'Sales',
  'Support',
  'Marketing',
  'Developer',
  'Admin',
];

/** Server limits (validated client-side too). */
export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 4000;

/** Lifecycle relative to today (Cairo). */
export type AnnouncementPhase = 'scheduled' | 'active' | 'expired';

/** Raw row of `GET /Announcements`, `/Announcements/Active` and hub events. */
export interface AnnouncementDto {
  id: number;
  title: string;
  body: string;
  targetRole: string | null;
  isPinned: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isRead: boolean;
  createdByName: string | null;
  createdAt: string;
  /** Admin only. */
  readCount?: number | null;
  /** Admin only. */
  targetCount?: number | null;
}

/**
 * One announcement as the UI uses it (normalised at the HTTP boundary).
 *
 * `startsOn` / `endsOn` are inclusive Cairo calendar days (`YYYY-MM-DD`).
 * `isActive` is the server's verdict for "live today for this audience" —
 * the UI never second-guesses it.
 */
export interface Announcement {
  id: number;
  title: string;
  body: string;
  target: AnnouncementTarget;
  isPinned: boolean;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  isRead: boolean;
  authorName: string | null;
  /** UTC ISO instant. */
  createdAt: string;
  /** Admin only — `null` for everyone else. */
  readCount: number | null;
  targetCount: number | null;
}

/** Body of `POST /Announcements` and `PUT /Announcements/{id}`. */
export interface AnnouncementInput {
  title: string;
  body: string;
  targetRole: AnnouncementTarget;
  isPinned: boolean;
  /** `YYYY-MM-DD` (Cairo), inclusive. */
  startDate: string;
  /** `YYYY-MM-DD` (Cairo), inclusive, `>= startDate`. */
  endDate: string;
}

/** Board query (`GET /Announcements`). */
export interface AnnouncementQuery {
  includeExpired: boolean;
  search: string;
}

/** Row of `GET /Announcements/{id}/Readers`. */
export interface AnnouncementReader {
  userId: string;
  fullName: string;
  hasRead: boolean;
  /** UTC ISO instant, `null` until read. */
  readAt: string | null;
}

/** Payload of the `announcementRemoved` hub event. */
export interface AnnouncementRemovedEvent {
  id: number;
}
