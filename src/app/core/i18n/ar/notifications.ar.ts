import { TranslationFile } from '../i18n.types';

const notifications: TranslationFile<'notifications'> = {
  notifications: {
    title: 'الإشعارات',
    subtitle: 'كل التنبيهات والتحديثات الخاصة بك',
    bellAria: 'الإشعارات',
    markAllRead: 'تعليم الكل كمقروء',
    viewAll: 'عرض كل الإشعارات',
    loadMore: 'تحميل المزيد',
    empty: 'لا توجد إشعارات',
    emptyHint: 'هتظهر هنا أي تنبيهات جديدة',
    unreadOnly: 'غير المقروءة فقط',
    justNow: 'الآن',
    minutesAgo: 'منذ {n} دقيقة',
    hoursAgo: 'منذ {n} ساعة',
    daysAgo: 'منذ {n} يوم',
    newBadge: 'جديد',
    filters: {
      all: 'الكل',
      unread: 'غير المقروء',
      read: 'المقروء',
    },
    center: {
      generateReminders: 'توليد تذكيرات المتابعة',
      sendNotification: 'إرسال إشعار',
      total: 'الإجمالي',
      unread: 'غير مقروء',
    },
    actions: {
      markRead: 'تعليم كمقروء',
      open: 'فتح',
    },
    send: {
      title: 'إرسال إشعار لموظف',
      userLabel: 'الموظف',
      userPlaceholder: 'اختر الموظف',
      titleLabel: 'العنوان',
      titlePlaceholder: 'عنوان الإشعار',
      messageLabel: 'الرسالة',
      messagePlaceholder: 'نص الإشعار…',
      submit: 'إرسال',
      cancel: 'إلغاء',
      required: 'هذا الحقل مطلوب',
    },
    toasts: {
      allRead: 'تم تعليم كل الإشعارات كمقروءة',
      remindersGenerated: 'تم توليد {n} تذكير متابعة',
      remindersNone: 'لا يوجد عملاء بحاجة لتذكير متابعة الآن',
      sent: 'تم إرسال الإشعار بنجاح',
      loadFailed: 'تعذّر تحميل الإشعارات',
    },
  },
};

export default notifications;
