import { UserRole } from '../../../core/models/auth.model';

/**
 * One step of the onboarding tour.
 *
 * `target` is a `[data-tour="…"]` value. Steps whose target isn't on screen
 * (e.g. the sidebar on a phone, a group the role can't see) are shown as a
 * centred card instead, so the tour never breaks.
 */
export interface TourStep {
  id: string;
  /** `data-tour` value of the element to spotlight; omit for a centred card. */
  target?: string;
  icon: string;
  titleKey: string;
  bodyKey: string;
  /** Only for these roles (omit = everyone). */
  roles?: UserRole[];
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  { id: 'welcome', icon: 'fa-solid fa-hand-sparkles', titleKey: 'commandCenter.tour.welcome.title', bodyKey: 'commandCenter.tour.welcome.body' },
  { id: 'sidebar', target: 'sidebar', icon: 'fa-solid fa-bars-staggered', titleKey: 'commandCenter.tour.sidebar.title', bodyKey: 'commandCenter.tour.sidebar.body' },
  { id: 'dashboards', target: 'nav-dashboards', icon: 'fa-solid fa-gauge-high', titleKey: 'commandCenter.tour.dashboards.title', bodyKey: 'commandCenter.tour.dashboards.body', roles: ['Admin'] },
  { id: 'sales', target: 'nav-sales', icon: 'fa-solid fa-sack-dollar', titleKey: 'commandCenter.tour.sales.title', bodyKey: 'commandCenter.tour.sales.body', roles: ['Admin', 'Sales'] },
  { id: 'marketing', target: 'nav-marketing', icon: 'fa-solid fa-bullhorn', titleKey: 'commandCenter.tour.marketing.title', bodyKey: 'commandCenter.tour.marketing.body', roles: ['Marketing'] },
  { id: 'support', target: 'nav-support', icon: 'fa-solid fa-headset', titleKey: 'commandCenter.tour.support.title', bodyKey: 'commandCenter.tour.support.body', roles: ['Support'] },
  { id: 'development', target: 'nav-development', icon: 'fa-solid fa-diagram-project', titleKey: 'commandCenter.tour.development.title', bodyKey: 'commandCenter.tour.development.body', roles: ['Developer'] },
  { id: 'reports', target: 'nav-reports', icon: 'fa-solid fa-chart-column', titleKey: 'commandCenter.tour.reports.title', bodyKey: 'commandCenter.tour.reports.body' },
  { id: 'chats', target: 'nav-chats', icon: 'fa-solid fa-comments', titleKey: 'commandCenter.tour.chats.title', bodyKey: 'commandCenter.tour.chats.body' },
  { id: 'announcements', target: 'nav-announcements', icon: 'fa-solid fa-tower-broadcast', titleKey: 'commandCenter.tour.announcements.title', bodyKey: 'commandCenter.tour.announcements.body' },
  { id: 'search', target: 'search', icon: 'fa-solid fa-magnifying-glass', titleKey: 'commandCenter.tour.search.title', bodyKey: 'commandCenter.tour.search.body' },
  { id: 'notifications', target: 'notifications', icon: 'fa-solid fa-bell', titleKey: 'commandCenter.tour.notifications.title', bodyKey: 'commandCenter.tour.notifications.body' },
  { id: 'profile', target: 'profile', icon: 'fa-solid fa-circle-user', titleKey: 'commandCenter.tour.profile.title', bodyKey: 'commandCenter.tour.profile.body' },
  { id: 'done', icon: 'fa-solid fa-rocket', titleKey: 'commandCenter.tour.done.title', bodyKey: 'commandCenter.tour.done.body' },
];
