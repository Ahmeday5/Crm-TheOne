import { InjectionToken, inject } from '@angular/core';
import { AnnouncementsRepository } from './announcements.repository';
import { MockAnnouncementsRepository } from './mock-announcements.repository';
// import { HttpAnnouncementsRepository } from './http-announcements.repository';

/**
 * The single switch between persistence adapters.
 *
 * Today the backend has no `/Announcements` endpoints, so the mock adapter is
 * active. When the API in `docs/api/announcements.md` is deployed, replace the
 * factory body with `inject(HttpAnnouncementsRepository)` — nothing else in
 * the app changes.
 */
export const ANNOUNCEMENTS_REPOSITORY = new InjectionToken<AnnouncementsRepository>(
  'ANNOUNCEMENTS_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(MockAnnouncementsRepository),
  },
);
