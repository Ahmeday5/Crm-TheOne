/**
 * Public surface of the announcements feature — the shell imports from here,
 * never from the feature's internals.
 */
export { AnnouncementBannerComponent } from './components/announcement-banner/announcement-banner.component';
export { AnnouncementsStore } from './state/announcements.store';
export { ANNOUNCEMENTS_ROUTES } from './announcements.routes';
