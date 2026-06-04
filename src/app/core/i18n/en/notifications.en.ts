import { TranslationFile } from '../i18n.types';

const notifications: TranslationFile<'notifications'> = {
  notifications: {
    title: 'Notifications',
    subtitle: 'All your alerts and updates',
    bellAria: 'Notifications',
    markAllRead: 'Mark all as read',
    viewAll: 'View all notifications',
    loadMore: 'Load more',
    empty: 'No notifications',
    emptyHint: 'New alerts will show up here',
    unreadOnly: 'Unread only',
    justNow: 'Just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    newBadge: 'New',
    filters: {
      all: 'All',
      unread: 'Unread',
      read: 'Read',
    },
    center: {
      generateReminders: 'Generate follow-up reminders',
      sendNotification: 'Send notification',
      total: 'Total',
      unread: 'Unread',
    },
    actions: {
      markRead: 'Mark as read',
      open: 'Open',
    },
    send: {
      title: 'Send a notification to an employee',
      userLabel: 'Employee',
      userPlaceholder: 'Select employee',
      titleLabel: 'Title',
      titlePlaceholder: 'Notification title',
      messageLabel: 'Message',
      messagePlaceholder: 'Notification body…',
      submit: 'Send',
      cancel: 'Cancel',
      required: 'This field is required',
    },
    toasts: {
      allRead: 'All notifications marked as read',
      remindersGenerated: '{n} follow-up reminders generated',
      remindersNone: 'No customers need a follow-up reminder right now',
      sent: 'Notification sent successfully',
      loadFailed: 'Failed to load notifications',
    },
  },
};

export default notifications;
