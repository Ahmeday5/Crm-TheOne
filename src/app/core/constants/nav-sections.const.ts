import { UserRole } from '../models/auth.model';

/**
 * Sidebar information architecture.
 *
 *   NavSection   titled block ("Marketing & sales")
 *   └─ NavEntry  either a direct link, or a collapsible group of links
 *
 * Visibility rules:
 *   - `roles` undefined ⇒ visible to every authenticated user
 *   - `roles` array     ⇒ visible only to those roles
 *   - a group is visible when at least one of its links is; a group with a
 *     single visible link is rendered as that plain link (no pointless
 *     dropdown around one item).
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
  /** Stay highlighted on nested routes too (e.g. `/whatsapp/chats/12`). */
  matchSubroutes?: boolean;
}

export interface NavGroup {
  kind: 'group';
  /** Stable id — persists the open/closed state. */
  id: string;
  labelKey: string;
  icon: string;
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export interface NavSection {
  /** i18n key for the section title. */
  titleKey: string;
  items: NavEntry[];
}

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return (entry as NavGroup).kind === 'group';
}

export function canSeeNavItem(item: NavItem, role: UserRole | null): boolean {
  return !!role && (!item.roles || item.roles.includes(role));
}

/** Every link in the tree, groups flattened (permissions matrix, search…). */
export function flattenNavItems(
  sections: ReadonlyArray<NavSection>,
): NavItem[] {
  return sections.flatMap((s) =>
    s.items.flatMap((e) => (isNavGroup(e) ? e.children : [e])),
  );
}

/** True when `url` (path only) is the page `item` points at. */
export function isNavItemActive(item: NavItem, url: string): boolean {
  const path = url.split(/[?#]/)[0] || '/';
  if (item.path === '/') return path === '/';
  if (path === item.path) return true;
  return !!item.matchSubroutes && path.startsWith(`${item.path}/`);
}

export const NAV_SECTIONS: NavSection[] = [
  // ── Overview ────────────────────────────────────────────────
  {
    titleKey: 'sidebar.sections.overview',
    items: [
      {
        kind: 'group',
        id: 'dashboards',
        labelKey: 'sidebar.groups.dashboards',
        icon: 'fa-solid fa-gauge-high',
        children: [
          {
            labelKey: 'sidebar.items.adminDashboard',
            path: '/',
            icon: 'fa-solid fa-table-cells-large',
            roles: ['Admin'],
          },
          {
            labelKey: 'sidebar.items.marketingDashboard',
            path: '/marketing-dashboard',
            icon: 'fa-solid fa-bullhorn',
            roles: ['Admin', 'Marketing'],
          },
          {
            labelKey: 'sidebar.items.salesDashboard',
            path: '/sales-dashboard',
            icon: 'fa-solid fa-chart-line',
            roles: ['Admin', 'Sales'],
          },
          {
            labelKey: 'sidebar.items.supportDashboard',
            path: '/appsupport-dashboard',
            icon: 'fa-solid fa-headset',
            roles: ['Admin', 'Support'],
          },
          {
            labelKey: 'sidebar.items.developersDashboard',
            path: '/developer-dashboard',
            icon: 'fa-solid fa-code',
            roles: ['Admin', 'Developer'],
          },
        ],
      },
    ],
  },

  // ── Departments: one dropdown per team with everything it works with ──
  {
    titleKey: 'sidebar.sections.departments',
    items: [
      {
        kind: 'group',
        id: 'marketing',
        labelKey: 'sidebar.groups.marketing',
        icon: 'fa-solid fa-bullhorn',
        children: [
          {
            labelKey: 'sidebar.items.leads',
            path: '/leads/marketing-leadsCustomer',
            icon: 'fa-solid fa-address-card',
            roles: ['Admin', 'Marketing'],
          },
          {
            labelKey: 'sidebar.items.campaigns',
            path: '/marketing-campaigns',
            icon: 'fa-solid fa-rectangle-ad',
            roles: ['Admin', 'Marketing'],
          },
        ],
      },
      {
        kind: 'group',
        id: 'sales',
        labelKey: 'sidebar.groups.sales',
        icon: 'fa-solid fa-sack-dollar',
        children: [
          {
            labelKey: 'sidebar.items.salesCustomers',
            path: '/leads/sales-leadsCustomer',
            icon: 'fa-solid fa-user-tie',
            roles: ['Admin', 'Sales'],
          },
          {
            labelKey: 'sidebar.items.salesPipeline',
            path: '/leads/sales-pipeline',
            icon: 'fa-solid fa-table-columns',
            roles: ['Admin', 'Sales'],
          },
          {
            labelKey: 'sidebar.items.priceOffers',
            path: '/price-offers',
            icon: 'fa-solid fa-file-invoice-dollar',
            roles: ['Admin', 'Sales'],
          },
          {
            labelKey: 'sidebar.items.contractsManage',
            path: '/contracts-management',
            icon: 'fa-solid fa-file-contract',
            roles: ['Admin', 'Sales'],
          },
          // Call scripts, objections, competitors, quick replies.
          {
            labelKey: 'sidebar.items.salesPlaybook',
            path: '/sales-playbook',
            icon: 'fa-solid fa-book-open-reader',
            roles: ['Admin', 'Sales', 'Support'],
          },
          {
            labelKey: 'sidebar.items.goals',
            path: '/goals',
            icon: 'fa-solid fa-bullseye',
            roles: ['Admin', 'Sales'],
          },
          {
            labelKey: 'sidebar.items.leaderboard',
            path: '/goals/leaderboard',
            icon: 'fa-solid fa-ranking-star',
            roles: ['Admin', 'Sales'],
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
        kind: 'group',
        id: 'support',
        labelKey: 'sidebar.groups.support',
        icon: 'fa-solid fa-headset',
        children: [
          {
            labelKey: 'sidebar.items.supportClients',
            path: '/Designated-clients',
            icon: 'fa-solid fa-user-shield',
            roles: ['Admin', 'Support'],
          },
          {
            labelKey: 'sidebar.items.kb',
            path: '/knowledge-base',
            icon: 'fa-solid fa-book',
            roles: ['Admin', 'Support', 'Developer'],
          },
        ],
      },
    ],
  },

  // ── Developers ──────────────────────────────────────────────
  {
    titleKey: 'sidebar.sections.developers',
    items: [
      {
        kind: 'group',
        id: 'development',
        labelKey: 'sidebar.groups.development',
        icon: 'fa-solid fa-code',
        children: [
          {
            labelKey: 'sidebar.items.projects',
            path: '/ProjectManage',
            icon: 'fa-solid fa-diagram-project',
            roles: ['Admin', 'Developer'],
          },
          {
            labelKey: 'sidebar.items.devAnalytics',
            path: '/developer-analytics',
            icon: 'fa-solid fa-chart-pie',
            roles: ['Admin', 'Developer'],
          },
          // Developers submit these from a project's "My Progress" page — this is their history.
          {
            labelKey: 'sidebar.items.myProjectReports',
            path: '/my-reports',
            icon: 'fa-solid fa-clipboard-check',
            roles: ['Developer'],
          },
        ],
      },
    ],
  },

  // ── Reports & analytics ─────────────────────────────────────
  {
    titleKey: 'sidebar.sections.reports',
    items: [
      {
        kind: 'group',
        id: 'reports',
        labelKey: 'sidebar.groups.reports',
        icon: 'fa-solid fa-chart-column',
        children: [
          // Every authenticated user submits; admins see all.
          {
            labelKey: 'sidebar.items.dailyReports',
            path: '/daily-reports',
            icon: 'fa-solid fa-file-lines',
          },
          // Source quality, best time to call, customer health, monthly reviews.
          {
            labelKey: 'sidebar.items.smartAnalytics',
            path: '/smart-analytics',
            icon: 'fa-solid fa-wand-magic-sparkles',
            roles: ['Admin', 'Marketing', 'Sales'],
          },
        ],
      },
    ],
  },

  {
    titleKey: 'sidebar.sections.overview',
    items: [
      // Every employee clocks in/out and requests leave; Admin also approves.
      {
        labelKey: 'sidebar.items.attendance',
        path: '/attendance',
        icon: 'fa-solid fa-user-clock',
      },
    ],
  },

  // ── Communication & scheduling ──────────────────────────────
  {
    titleKey: 'sidebar.sections.communication',
    items: [
      {
        kind: 'group',
        id: 'chats',
        labelKey: 'sidebar.groups.chats',
        icon: 'fa-solid fa-comments',
        children: [
          // Customer WhatsApp inbox — each employee chats from their own number.
          {
            labelKey: 'sidebar.items.whatsapp',
            path: '/whatsapp',
            icon: 'fa-brands fa-whatsapp',
            roles: ['Admin', 'Sales', 'Support'],
            matchSubroutes: true,
          },
          // Employee-to-employee chat.
          {
            labelKey: 'sidebar.items.teamChat',
            path: '/team-chat',
            icon: 'fa-solid fa-user-group',
            matchSubroutes: true,
          },
          {
            labelKey: 'sidebar.items.whatsappNumbers',
            path: '/whatsapp/numbers',
            icon: 'fa-solid fa-sim-card',
            roles: ['Admin'],
          },
        ],
      },
      {
        kind: 'group',
        id: 'announcements',
        labelKey: 'sidebar.groups.announcements',
        icon: 'fa-solid fa-tower-broadcast',
        children: [
          {
            labelKey: 'sidebar.items.announcements',
            path: '/announcements',
            icon: 'fa-solid fa-thumbtack',
          },
          {
            labelKey: 'sidebar.items.notifications',
            path: '/notifications',
            icon: 'fa-solid fa-bell',
            roles: ['Admin'],
          },
        ],
      },
      {
        labelKey: 'sidebar.items.schedule',
        path: '/schedule',
        icon: 'fa-solid fa-calendar-days',
        roles: ['Admin', 'Sales', 'Support'],
      },
    ],
  },

  // ── System ──────────────────────────────────────────────────
  {
    titleKey: 'sidebar.sections.system',
    items: [
      // Services management lives inside settings (Marketing sees only that tab).
      {
        labelKey: 'sidebar.items.settings',
        path: '/settings',
        icon: 'fa-solid fa-gear',
        roles: ['Admin', 'Marketing'],
        matchSubroutes: true,
      },
      {
        labelKey: 'sidebar.items.resources',
        path: '/resources',
        icon: 'fa-solid fa-users-gear',
        roles: ['Admin'],
      },
    ],
  },
];

/**
 * Maps a top-level URL segment → roles allowed to enter it.
 * Used by the role guard so a user typing the URL by hand still hits a wall.
 *
 * Anything not in this map is allowed for any authenticated user.
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
  'smart-analytics': ['Admin', 'Marketing', 'Sales'],
  'sales-playbook': ['Admin', 'Sales', 'Support'],

  // Sales-only modules
  line: ['Admin', 'Sales'],
  'price-offers': ['Admin', 'Sales'],
  contracts: ['Admin', 'Sales'],
  'follow-ups': ['Admin', 'Sales'],
  'view-details-deal': ['Admin', 'Sales'],
  'price-offer-contract': ['Admin', 'Sales'],
  'contracts-management': ['Admin', 'Sales'],
  'sale-contract': ['Admin', 'Sales'],

  // Support modules
  dashboardSupport: ['Admin', 'Support'],
  'Designated-clients': ['Admin', 'Support'],
  SupportTickets: ['Admin', 'Support'],
  SupportLog: ['Admin', 'Support'],
  'technical-consultation': ['Admin', 'Support'],
  'details-of-support-cases': ['Admin', 'Support'],

  // Developer modules
  ProjectManage: ['Admin', 'Developer'],
  TasksManage: ['Admin', 'Developer'],
  'developer-analytics': ['Admin', 'Developer'],
  webhooks: ['Admin', 'Developer'],

  // Cross-role
  schedule: ['Admin', 'Sales', 'Support'],
  whatsapp: ['Admin', 'Sales', 'Support'],
  'knowledge-base': ['Admin', 'Support', 'Developer'],
  // `announcements` and `team-chat` are intentionally NOT listed — every
  // employee reads announcements and chats; publishing is gated in the page.

  // Admin-only
  ReportAndAnalytics: ['Admin'],
  settings: ['Admin', 'Marketing'],
  services: ['Admin', 'Marketing'],
  'system-improvements': ['Admin'],
  resources: ['Admin'],
  // The notification center (history + manual send) is an admin tool; the
  // header bell stays available to every role.
  notifications: ['Admin'],
  goals: ['Admin', 'Sales'],
  security: ['Admin'],
  'my-reports': ['Admin', 'Developer'],
};
