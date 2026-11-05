import { UserRole } from '../../../core/models/auth.model';

/** Departments an announcement can target (the publisher is always an Admin). */
export type AnnouncementDepartment = Exclude<UserRole, 'Admin'>;

export const ANNOUNCEMENT_DEPARTMENTS: ReadonlyArray<AnnouncementDepartment> = [
  'Sales',
  'Marketing',
  'Support',
  'Developer',
];

/** Visual weight — drives the banner / card accent colour. */
export type AnnouncementTone = 'info' | 'success' | 'warning' | 'danger';

export const ANNOUNCEMENT_TONES: ReadonlyArray<AnnouncementTone> = [
  'info',
  'success',
  'warning',
  'danger',
];

/**
 * `all`   → every employee.
 * `roles` → only the listed departments (`roles` is non-empty).
 */
export type AnnouncementAudience = 'all' | 'roles';

/** Lifecycle derived from today's date vs. the [startsOn, endsOn] window. */
export type AnnouncementPhase = 'scheduled' | 'active' | 'expired';

export interface AnnouncementAuthor {
  id: string;
  name: string;
}

/**
 * One announcement, as seen by the current user.
 *
 * `startsOn` / `endsOn` are calendar dates (`YYYY-MM-DD`, Cairo time) and both
 * are inclusive: the banner shows from the first moment of `startsOn` until
 * the end of `endsOn`, then disappears on its own.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  roles: AnnouncementDepartment[];
  isPinned: boolean;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  updatedAt: string | null;
  author: AnnouncementAuthor;

  /** Has the *current* user marked it as read? */
  isRead: boolean;
  readAt: string | null;

  /** Admin insight: how many targeted employees read it / were targeted. */
  readCount: number;
  recipientsCount: number;
}

/** Body for create / update. */
export interface AnnouncementInput {
  title: string;
  body: string;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  roles: AnnouncementDepartment[];
  isPinned: boolean;
  startsOn: string;
  endsOn: string;
}
