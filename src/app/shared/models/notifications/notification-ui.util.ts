import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { UserRole } from '../../../core/models/auth.model';
import { Lang } from '../../../core/services/language.service';
import {
  ANNOUNCEMENT_ENTITY,
  LEAVE_REQUEST_ENTITY,
  NotificationType,
  WHATSAPP_CHAT_ENTITY,
  isWhatsAppNotification,
} from './notification.model';

/** The fields of a notification (or its live toast) that decide where it leads. */
export interface NotificationTarget {
  type: NotificationType;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
}

/** Roles that chat with customers on WhatsApp inside the CRM. */
const WHATSAPP_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

/** Font-Awesome icon for a notification type. */
export function notificationIcon(type: NotificationType): string {
  if (isWhatsAppNotification({ type, relatedEntityType: null })) return 'fa-brands fa-whatsapp';
  switch (type) {
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
    default: return 'fa-solid fa-bell';
  }
}

/** `.icon-tile.tone-*` modifier for the type's avatar. */
export function notificationTone(type: NotificationType): string {
  if (isWhatsAppNotification({ type, relatedEntityType: null })) return 'success';
  switch (type) {
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
export function notificationRoute(n: NotificationTarget, role: UserRole | null): string[] | null {
  const entityType = n.relatedEntityType;
  const notifType = n.type;

  if (isWhatsAppNotification(n)) {
    if (!role || !WHATSAPP_ROLES.includes(role)) return null;
    // Older payloads may carry no chat id — the inbox is still the right place.
    const chatId = n.relatedEntityType === WHATSAPP_CHAT_ENTITY ? n.relatedEntityId : null;
    return chatId ? ['/whatsapp', 'chats', String(chatId)] : ['/whatsapp'];
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
