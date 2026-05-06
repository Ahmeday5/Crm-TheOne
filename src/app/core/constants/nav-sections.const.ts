import { UserRole } from '../models/auth.model';

/**
 * Navigation entry rendered in the sidebar.
 *
 *   - `roles` undefined ⇒ visible to every authenticated user
 *   - `roles` array     ⇒ visible only to those roles
 */
export interface NavItem {
  /** i18n key, resolved via TranslatePipe. */
  labelKey: string;
  /** Absolute router-link path (kept identical to the existing routes). */
  path: string;
  /** Font-Awesome class string. */
  icon: string;
  /** Roles allowed to see/use the item. Omit to allow all. */
  roles?: UserRole[];
}

export interface NavSection {
  /** i18n key for the section title. */
  titleKey: string;
  items: NavItem[];
}

/**
 * Per-role sidebar map. Sidebar filters this at render time:
 *   - drops items whose `roles` doesn't include the current role
 *   - drops sections that end up with zero visible items
 *
 * IMPORTANT: paths are kept exactly as they were before (so deep links keep
 * working). New items get sensible kebab-case placeholders.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'sidebar.sections.role',
    items: [
      {
        labelKey: 'sidebar.items.admin',
        path: '/',
        icon: 'fa-solid fa-table-cells-large',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.marketing',
        path: '/marketing-dashboard',
        icon: 'fa-solid fa-users',
        roles: ['Admin', 'Marketing'],
      },
      {
        labelKey: 'sidebar.items.sales',
        path: '/sales-dashboard',
        icon: 'fa-solid fa-chart-line',
        roles: ['Admin', 'Sales'],
      },
      {
        labelKey: 'sidebar.items.support',
        path: '/appsupport-dashboard',
        icon: 'fa-solid fa-headset',
        roles: ['Admin', 'Support'],
      },
      {
        labelKey: 'sidebar.items.developers',
        path: '/developer-dashboard',
        icon: 'fa-solid fa-code',
        roles: ['Admin', 'Developer'],
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.marketingSales',
    items: [
      {
        labelKey: 'sidebar.items.campaigns',
        path: '/marketing-campaigns',
        icon: 'fa-solid fa-bullhorn',
        roles: ['Admin', 'Marketing'],
      },
      {
        labelKey: 'sidebar.items.salesAnalysis',
        path: '/sales-analysis',
        icon: 'fa-solid fa-chart-column',
        roles: ['Admin', 'Marketing'],
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.mainModules',
    items: [
      // Marketing-side leads list (also visible to Admin).
      {
        labelKey: 'sidebar.items.leads',
        path: '/leads/marketing-leadsCustomer',
        icon: 'fa-solid fa-address-card',
        roles: ['Admin', 'Marketing'],
      },
      // Sales-side leads list (only visible to Sales — Admin already sees the marketing one).
      {
        labelKey: 'sidebar.items.leads',
        path: '/leads/sales-leadsCustomer',
        icon: 'fa-solid fa-address-card',
        roles: ['Sales'],
      },
      {
        labelKey: 'sidebar.items.salesLine',
        path: '/line',
        icon: 'fa-solid fa-chart-line',
        roles: ['Admin', 'Sales'],
      },
      {
        labelKey: 'sidebar.items.support',
        path: '/dashboardSupport',
        icon: 'fa-solid fa-headset',
        roles: ['Admin', 'Support'],
      },
      {
        labelKey: 'sidebar.items.projects',
        path: '/ProjectManage',
        icon: 'fa-solid fa-table-columns',
        roles: ['Admin', 'Developer'],
      },
      {
        labelKey: 'sidebar.items.reports',
        path: '/ReportAndAnalytics',
        icon: 'fa-solid fa-chart-bar',
        roles: ['Admin'],
      },
      // Chat is for everyone (no `roles`).
      {
        labelKey: 'sidebar.items.chat',
        path: '/internal-chat',
        icon: 'fa-regular fa-comment-dots',
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.system',
    items: [
      {
        labelKey: 'sidebar.items.settings',
        path: '/settings',
        icon: 'fa-solid fa-gear',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.services',
        path: '/services',
        icon: 'fa-solid fa-screwdriver-wrench',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.kb',
        path: '/knowledge-base',
        icon: 'fa-solid fa-book',
        roles: ['Admin', 'Support', 'Developer'],
      },
      {
        labelKey: 'sidebar.items.improvements',
        path: '/system-improvements',
        icon: 'fa-solid fa-bolt',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.resources',
        path: '/resources',
        icon: 'fa-solid fa-users-gear',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.notifications',
        path: '/notifications',
        icon: 'fa-solid fa-bell',
        roles: ['Admin'],
      },
      {
        labelKey: 'sidebar.items.devAnalytics',
        path: '/developer-analytics',
        icon: 'fa-solid fa-chart-line',
        roles: ['Admin', 'Developer'],
      },
      {
        labelKey: 'sidebar.items.webhooks',
        path: '/webhooks',
        icon: 'fa-solid fa-plug',
        roles: ['Admin', 'Developer'],
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.contracts',
    items: [
      {
        labelKey: 'sidebar.items.contractsManage',
        path: '/contracts-management',
        icon: 'fa-solid fa-file-contract',
        roles: ['Admin', 'Sales'],
      },
      {
        labelKey: 'sidebar.items.schedule',
        path: '/schedule',
        icon: 'fa-solid fa-calendar-days',
        roles: ['Admin', 'Sales', 'Support'],
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.performance',
    items: [
      {
        labelKey: 'sidebar.items.goals',
        path: '/goals',
        icon: 'fa-solid fa-trophy',
        roles: ['Admin'],
      },
    ],
  },
  {
    titleKey: 'sidebar.sections.security',
    items: [
      {
        labelKey: 'sidebar.items.mfa',
        path: '/security/mfa',
        icon: 'fa-solid fa-shield-halved',
        roles: ['Admin'],
      },
    ],
  },
];

/**
 * Maps a top-level URL segment → roles allowed to enter it.
 * Used by the role guard so a user typing the URL by hand still hits a wall.
 *
 * Anything not in this map is allowed for any authenticated user (chat, etc.).
 */
export const ROUTE_ROLE_MAP: Readonly<Record<string, UserRole[]>> = {
  // Dashboards — root '' (homepage) is Admin-only.
  '': ['Admin'],
  'marketing-dashboard': ['Admin', 'Marketing'],
  'sales-dashboard': ['Admin', 'Sales'],
  'appsupport-dashboard': ['Admin', 'Support'],
  'developer-dashboard': ['Admin', 'Developer'],

  // Marketing-only
  'marketing-campaigns': ['Admin', 'Marketing'],
  'sales-analysis': ['Admin', 'Marketing'],

  // Sales-only modules
  'line': ['Admin', 'Sales'],
  'price-offers': ['Admin', 'Sales'],
  'contracts': ['Admin', 'Sales'],
  'follow-ups': ['Admin', 'Sales'],
  'view-details-deal': ['Admin', 'Sales'],
  'add-price-offer': ['Admin', 'Sales'],
  'contracts-management': ['Admin', 'Sales'],

  // Support modules
  'dashboardSupport': ['Admin', 'Support'],
  'Designated-clients': ['Admin', 'Support'],
  'SupportTickets': ['Admin', 'Support'],
  'SupportLog': ['Admin', 'Support'],
  'technical-consultation': ['Admin', 'Support'],
  'details-of-support-cases': ['Admin', 'Support'],

  // Developer modules
  'ProjectManage': ['Admin', 'Developer'],
  'TasksManage': ['Admin', 'Developer'],
  'developer-analytics': ['Admin', 'Developer'],
  'webhooks': ['Admin', 'Developer'],

  // Cross-role
  'schedule': ['Admin', 'Sales', 'Support'],
  'knowledge-base': ['Admin', 'Support', 'Developer'],

  // Admin-only
  'ReportAndAnalytics': ['Admin'],
  'settings': ['Admin'],
  'services': ['Admin'],
  'system-improvements': ['Admin'],
  'resources': ['Admin'],
  'notifications': ['Admin'],
  'goals': ['Admin'],
  'security': ['Admin'],
};
