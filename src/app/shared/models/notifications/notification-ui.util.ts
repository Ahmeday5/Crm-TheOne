import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { UserRole } from '../../../core/models/auth.model';
import { Lang } from '../../../core/services/language.service';
import {
  ANNOUNCEMENT_ENTITY,
  CLIENT_REQUEST_ENTITY,
  CONTRACT_ENTITY,
  LEAVE_REQUEST_ENTITY,
  PROJECT_ENTITY,
  NotificationType,
  PAYMENT_REQUEST_ENTITY,
  WHATSAPP_CHAT_ENTITY,
  isContractNotification,
  isPaymentNotification,
  isWhatsAppNotification,
  notificationTypeName,
} from './notification.model';

/** The fields of a notification (or its live toast) that decide where it leads. */
export interface NotificationTarget {
  type: NotificationType;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  /** Contract v2: the project of a client-request / release / milestone notification. */
  projectId?: number | null;
}

/** Client-request notifications that mean "your decision is needed" (Admin → triage inbox). */
const ADMIN_TRIAGE_TYPES: ReadonlySet<string> = new Set([
  'ClientRequestCreated',
  'ClientRequestClarificationAnswered',
]);

/** `relatedEntityType` of a discount-approval notification (inbox v4 section 9) - id = the approval. */
const DISCOUNT_APPROVAL_ENTITY = 'DiscountApproval';

function isDiscountApprovalNotification(n: { type: NotificationType; relatedEntityType: string | null }): boolean {
  return n.relatedEntityType === DISCOUNT_APPROVAL_ENTITY || String(notificationTypeName(n.type)).startsWith('DiscountApproval');
}

/** Roles that chat with customers on WhatsApp inside the CRM. */
const WHATSAPP_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

/** Font-Awesome icon for a notification type. */
export function notificationIcon(type: NotificationType): string {
  if (isWhatsAppNotification({ type, relatedEntityType: null })) return 'fa-brands fa-whatsapp';
  if (isPaymentNotification({ type, relatedEntityType: null })) return 'fa-solid fa-money-check-dollar';
  switch (notificationTypeName(type)) {
    case 'NewSupportTicket': return 'fa-solid fa-headset';
    case 'CustomerReturnedToSales': return 'fa-solid fa-rotate-left';
    case 'NewCustomerAssigned': return 'fa-solid fa-user-plus';
    case 'CustomerTransferredToSupport': return 'fa-solid fa-right-left';
    case 'AppointmentScheduled': return 'fa-solid fa-calendar-check';
    case 'FollowUpReminder': return 'fa-solid fa-bell-concierge';
    case 'TaskAssigned': return 'fa-solid fa-list-check';
    case 'ProjectAssigned': return 'fa-solid fa-diagram-project';
    case 'GoalAssigned': return 'fa-solid fa-bullseye';
    case 'GoalAchieved': return 'fa-solid fa-trophy';
    case 'Announcement': return 'fa-solid fa-bullhorn';
    case 'LeaveRequestSubmitted': return 'fa-solid fa-plane-departure';
    case 'LeaveRequestReviewed': return 'fa-solid fa-calendar-check';
    case 'ContractExpiringSoon': return 'fa-solid fa-hourglass-half';
    case 'ContractExpired': return 'fa-solid fa-file-circle-xmark';
    case 'ContractRenewed': return 'fa-solid fa-file-circle-check';
    case 'ClientRequestCreated': return 'fa-solid fa-comment-medical';
    case 'ClientRequestUpdated': return 'fa-solid fa-comment-dots';
    case 'ClientRequestComment': return 'fa-solid fa-comments';
    case 'ClientRequestClarificationAnswered': return 'fa-solid fa-reply';
    case 'ClientRequestApproved': return 'fa-solid fa-circle-check';
    case 'ClientRequestAssigned': return 'fa-solid fa-user-check';
    case 'ClientRequestRejected': return 'fa-solid fa-ban';
    case 'ClientRequestClarificationRequested': return 'fa-solid fa-circle-question';
    case 'ProjectReleasePublished': return 'fa-solid fa-rocket';
    case 'MilestoneUpdatedByDeveloper': return 'fa-solid fa-flag-checkered';
    case 'ProjectReachedFullProgress': return 'fa-solid fa-trophy';
    case 'DiscountApprovalRequested': return 'fa-solid fa-percent';
    case 'DiscountApprovalDecided': return 'fa-solid fa-stamp';
    // Unknown / future types still render — with the generic bell.
    default: return 'fa-solid fa-bell';
  }
}

/** `.icon-tile.tone-*` modifier for the type's avatar. */
export function notificationTone(type: NotificationType): string {
  if (isWhatsAppNotification({ type, relatedEntityType: null })) return 'success';
  if (isPaymentNotification({ type, relatedEntityType: null })) return 'info';
  switch (notificationTypeName(type)) {
    case 'NewSupportTicket': return 'warning';
    case 'CustomerReturnedToSales': return 'info';
    case 'NewCustomerAssigned': return 'success';
    case 'CustomerTransferredToSupport': return 'purple';
    case 'AppointmentScheduled': return 'info';
    case 'FollowUpReminder': return 'warning';
    case 'TaskAssigned': return 'primary';
    case 'ProjectAssigned': return 'success';
    case 'GoalAssigned': return 'purple';
    case 'GoalAchieved': return 'warning';
    case 'Announcement': return 'orange';
    case 'LeaveRequestSubmitted': return 'info';
    case 'LeaveRequestReviewed': return 'success';
    case 'ContractExpiringSoon': return 'warning';
    case 'ContractExpired': return 'danger';
    case 'ContractRenewed': return 'success';
    case 'ClientRequestCreated': return 'warning';
    case 'ClientRequestUpdated': return 'info';
    case 'ClientRequestComment': return 'primary';
    case 'ClientRequestClarificationAnswered': return 'success';
    case 'ClientRequestApproved': return 'success';
    case 'ClientRequestAssigned': return 'primary';
    case 'ClientRequestRejected': return 'danger';
    case 'ClientRequestClarificationRequested': return 'warning';
    case 'ProjectReleasePublished': return 'success';
    case 'MilestoneUpdatedByDeveloper': return 'info';
    case 'ProjectReachedFullProgress': return 'warning';
    case 'DiscountApprovalRequested': return 'warning';
    case 'DiscountApprovalDecided': return 'success';
    default: return 'primary';
  }
}

/**
 * Resolve the in-app route a notification should open, scoped to the viewer's
 * role (the same notification reaches different roles, each with its own page).
 * Returns `null` when there's no sensible destination for that role — the click
 * then just marks the notification read.
 *
 * `relatedEntityType` is the preferred signal; `type` is the fallback when the
 * backend didn't set an entity.
 */
/** Contract v2 §11: which project-workspace tab a staff notification opens on. */
export function notificationQuery(n: NotificationTarget): Record<string, string> | undefined {
  // Payment: `/payments?request=<id>` opens that request's details.
  if (isPaymentNotification(n)) {
    const id = n.relatedEntityType === PAYMENT_REQUEST_ENTITY ? n.relatedEntityId : null;
    return id ? { request: String(id) } : { status: 'CustomerConfirmed' };
  }
  const t = notificationTypeName(n.type);
  if (t.startsWith('ClientRequest') || n.relatedEntityType === CLIENT_REQUEST_ENTITY) {
    // Lands on the requests list; the user opens the request themselves.
    return { tab: 'requests' };
  }
  if (t === 'ProjectReleasePublished') return { tab: 'deliverables' };
  if (t === 'MilestoneUpdatedByDeveloper') return { tab: 'milestones' };
  return undefined;
}

export function notificationRoute(n: NotificationTarget, role: UserRole | null): string[] | null {
  const entityType = n.relatedEntityType;
  const notifType = notificationTypeName(n.type);

  if (isWhatsAppNotification(n)) {
    if (!role || !WHATSAPP_ROLES.includes(role)) return null;
    // Older payloads may carry no chat id — the inbox is still the right place.
    const chatId = n.relatedEntityType === WHATSAPP_CHAT_ENTITY ? n.relatedEntityId : null;
    return chatId ? ['/whatsapp', 'chats', String(chatId)] : ['/whatsapp'];
  }

  if (isPaymentNotification(n)) {
    return role && WHATSAPP_ROLES.includes(role) ? ['/payments'] : null;
  }

  // Discount approvals: the Admin opens the request card (approve / reject /
  // resend the code); the requester opens their request and sees the code.
  // An open quotation / payment-link form also fills the code by itself.
  if (isDiscountApprovalNotification(n)) {
    if (role !== 'Admin' && role !== 'Sales' && role !== 'Marketing' && role !== 'Support') return null;
    const id = n.relatedEntityType === DISCOUNT_APPROVAL_ENTITY || !n.relatedEntityType ? n.relatedEntityId : null;
    return id ? ['/discount-approvals', String(id)] : ['/discount-approvals'];
  }

  const staff = role === 'Admin' || role === 'Developer';

  // Client requests: what waits for the Admin's decision opens the inbox;
  // everything else opens the project's requests tab (needs `projectId`).
  if (entityType === CLIENT_REQUEST_ENTITY || String(notifType).startsWith('ClientRequest')) {
    if (role === 'Admin' && ADMIN_TRIAGE_TYPES.has(String(notifType))) return ['/client-requests'];
    if (staff && n.projectId) return ['/projects', String(n.projectId)];
    return role === 'Admin' ? ['/client-requests'] : null;
  }

  // Releases / milestones / 100%: the project's workspace.
  if (notifType === 'ProjectReleasePublished' || notifType === 'MilestoneUpdatedByDeveloper' || notifType === 'ProjectReachedFullProgress') {
    const pid = n.projectId ?? (entityType === PROJECT_ENTITY ? n.relatedEntityId : null);
    return staff && pid ? ['/projects', String(pid)] : null;
  }

  // A project (e.g. "you were added to a project"): its workspace.
  if (entityType === PROJECT_ENTITY && n.relatedEntityId) {
    return role === 'Admin' || role === 'Developer' ? ['/projects', String(n.relatedEntityId)] : null;
  }

  // Old GitHub build notifications (feature removed): mark read only.
  if (String(notifType).startsWith('ProjectBuild')) return null;

  // Contracts: the contract's page (Admin / Sales — the only roles that receive them).
  if (isContractNotification(n)) {
    if (role !== 'Admin' && role !== 'Sales') return null;
    const id = n.relatedEntityType === CONTRACT_ENTITY ? n.relatedEntityId : null;
    return id ? ['/contracts', String(id)] : ['/contracts-management'];
  }

  // Announcements: everyone; the id opens that announcement on the board.
  if (entityType === ANNOUNCEMENT_ENTITY || notifType === 'Announcement') {
    return entityType === ANNOUNCEMENT_ENTITY && n.relatedEntityId
      ? ['/announcements', String(n.relatedEntityId)]
      : ['/announcements'];
  }

  // Leave: a new request goes to the admin inbox, a decision to "my leave".
  if (notifType === 'LeaveRequestSubmitted') {
    return role === 'Admin' ? ['/attendance', 'requests'] : null;
  }
  if (notifType === 'LeaveRequestReviewed') return ['/attendance', 'leaves'];
  if (entityType === LEAVE_REQUEST_ENTITY) {
    return role === 'Admin' ? ['/attendance', 'requests'] : ['/attendance', 'leaves'];
  }

  // ── Primary: entity-type routing (most specific) ──
  switch (entityType) {
    case 'SupportTicket':
      return role === 'Admin' || role === 'Support' ? ['/SupportTickets'] : null;

    case 'Appointment':
      return role === 'Admin' || role === 'Sales' || role === 'Support'
        ? ['/schedule']
        : null;

    case 'Customer':
      return customerRoute(role);

    case 'Task':
      return role === 'Admin' || role === 'Developer' ? ['/TasksManage'] : null;

    case 'Project':
      return role === 'Admin' || role === 'Developer' ? ['/ProjectManage'] : null;

    case 'Goal':
      return role === 'Admin' || role === 'Sales' ? ['/goals'] : null;
  }

  // ── Fallback: derive destination from the notification type ──
  switch (notifType) {
    case 'NewSupportTicket':
      return role === 'Admin' || role === 'Support' ? ['/SupportTickets'] : null;

    case 'AppointmentScheduled':
      return role === 'Admin' || role === 'Sales' || role === 'Support'
        ? ['/schedule']
        : null;

    case 'NewCustomerAssigned':
    case 'CustomerTransferredToSupport':
    case 'CustomerReturnedToSales':
    case 'FollowUpReminder':
      return customerRoute(role);

    case 'TaskAssigned':
      return role === 'Admin' || role === 'Developer' ? ['/TasksManage'] : null;

    case 'ProjectAssigned':
      return role === 'Admin' || role === 'Developer' ? ['/ProjectManage'] : null;

    case 'GoalAssigned':
    case 'GoalAchieved':
      return role === 'Admin' || role === 'Sales' ? ['/goals'] : null;

    default:
      return null;
  }
}

function customerRoute(role: UserRole | null): string[] | null {
  switch (role) {
    case 'Marketing': return ['/leads/marketing-leadsCustomer'];
    case 'Sales':     return ['/leads/sales-leadsCustomer'];
    case 'Support':   return ['/Designated-clients'];
    case 'Admin':     return ['/leads/sales-leadsCustomer'];
    default:          return null;
  }
}

/** Localised "x minutes ago" relative timestamp. */
export function relativeTime(iso: string, lang: Lang): string {
  const dict = TRANSLATIONS[lang];
  const t = (key: string) => resolveKey(dict, key);
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo').replace('{n}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo').replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo').replace('{n}', String(days));

  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
