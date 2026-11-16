import { UserRole } from '../models/auth.model';

/** Landing dashboard per role. */
export const ROLE_HOME: Readonly<Record<UserRole, string>> = {
  Admin: '/',
  Marketing: '/marketing-dashboard',
  Sales: '/sales-dashboard',
  Support: '/appsupport-dashboard',
  Developer: '/developer-dashboard',
  Client: '/portal',
};

/** The page each role works in all day (customers, or tasks for developers). */
export const ROLE_WORKSPACE: Readonly<Record<UserRole, { path: string; labelKey: string; icon: string }>> = {
  Admin: { path: '/leads/sales-leadsCustomer', labelKey: 'bottomNav.customers', icon: 'fa-solid fa-users' },
  Sales: { path: '/leads/sales-leadsCustomer', labelKey: 'bottomNav.customers', icon: 'fa-solid fa-users' },
  Marketing: { path: '/leads/marketing-leadsCustomer', labelKey: 'bottomNav.customers', icon: 'fa-solid fa-users' },
  Support: { path: '/Designated-clients', labelKey: 'bottomNav.customers', icon: 'fa-solid fa-users' },
  Developer: { path: '/TasksManage', labelKey: 'bottomNav.tasks', icon: 'fa-solid fa-list-check' },
  Client: { path: '/portal', labelKey: 'bottomNav.myProjects', icon: 'fa-solid fa-diagram-project' },
};

/** Customer-facing roles chat on WhatsApp; the others use team chat. */
export const ROLE_CHAT: Readonly<Record<UserRole, { path: string; labelKey: string; icon: string }>> = {
  Admin: { path: '/whatsapp', labelKey: 'bottomNav.whatsapp', icon: 'fa-brands fa-whatsapp' },
  Sales: { path: '/whatsapp', labelKey: 'bottomNav.whatsapp', icon: 'fa-brands fa-whatsapp' },
  Support: { path: '/whatsapp', labelKey: 'bottomNav.whatsapp', icon: 'fa-brands fa-whatsapp' },
  Marketing: { path: '/team-chat', labelKey: 'bottomNav.chat', icon: 'fa-solid fa-comments' },
  Developer: { path: '/team-chat', labelKey: 'bottomNav.chat', icon: 'fa-solid fa-comments' },
  // Clients talk to the team through their project's requests, not chat.
  Client: { path: '/portal', labelKey: 'bottomNav.requests', icon: 'fa-solid fa-message' },
};
