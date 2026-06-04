import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { UserRole } from '../../../core/models/auth.model';
import { Lang } from '../../../core/services/language.service';
import { NotificationType } from './notification.model';

/** Font-Awesome icon for a notification type. */
export function notificationIcon(type: NotificationType): string {
  switch (type) {
    case 'NewSupportTicket': return 'fa-solid fa-headset';
    case 'CustomerReturnedToSales': return 'fa-solid fa-rotate-left';
    case 'NewCustomerAssigned': return 'fa-solid fa-user-plus';
    case 'CustomerTransferredToSupport': return 'fa-solid fa-right-left';
    case 'AppointmentScheduled': return 'fa-solid fa-calendar-check';
    case 'FollowUpReminder': return 'fa-solid fa-bell-concierge';
    default: return 'fa-solid fa-bell';
  }
}

/** `.icon-tile.tone-*` modifier for the type's avatar. */
export function notificationTone(type: NotificationType): string {
  switch (type) {
    case 'NewSupportTicket': return 'warning';
    case 'CustomerReturnedToSales': return 'info';
    case 'NewCustomerAssigned': return 'success';
    case 'CustomerTransferredToSupport': return 'purple';
    case 'AppointmentScheduled': return 'info';
    case 'FollowUpReminder': return 'warning';
    default: return 'primary';
  }
}

/**
 * Resolve the in-app route a notification should open, scoped to the viewer's
 * role (the same notification reaches different roles, each with its own page).
 * Returns `null` when there's no sensible destination for that role — the click
 * then just marks the notification read.
 */
export function notificationRoute(
  entityType: string | null | undefined,
  role: UserRole | null,
): string[] | null {
  switch (entityType) {
    case 'SupportTicket':
      return role === 'Admin' || role === 'Support' ? ['/SupportTickets'] : null;

    case 'Appointment':
      return role === 'Admin' || role === 'Sales' || role === 'Support'
        ? ['/schedule']
        : null;

    case 'Customer':
      switch (role) {
        case 'Marketing': return ['/leads/marketing-leadsCustomer'];
        case 'Sales': return ['/leads/sales-leadsCustomer'];
        case 'Support': return ['/Designated-clients'];
        case 'Admin': return ['/leads/sales-leadsCustomer'];
        default: return null;
      }

    default:
      return null;
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
