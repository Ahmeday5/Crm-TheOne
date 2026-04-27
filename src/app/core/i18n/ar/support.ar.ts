import { TranslationFile } from '../i18n.types';

const support: TranslationFile<'support'> = {
  support: {
    title: 'الدعم الفني',
    subtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    tabs: {
      dashboard: 'لوحة التحكم',
      designatedClients: 'العملاء المعينون',
      tickets: 'تذاكر الدعم',
      log: 'السجل',
    },
    dashboard: { title: 'لوحة الدعم الفني', subtitle: 'تذاكر الدعم وحالة العملاء' },
    designatedClients: {
      title: 'العملاء المعينون',
      list: 'قائمة العملاء المعينين',
    },
    technicalConsultation: {
      title: 'الاستشارة الفنية',
      subject: 'الموضوع',
      consultant: 'المستشار',
      duration: 'المدة',
    },
    tickets: {
      title: 'تذاكر الدعم',
      number: 'رقم التذكرة',
      subject: 'الموضوع',
      priority: 'الأولوية',
      assignee: 'المسؤول',
      created: 'تاريخ الإنشاء',
      lastUpdate: 'آخر تحديث',
      priorities: { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' },
      statuses: { open: 'مفتوحة', pending: 'قيد المعالجة', resolved: 'محلولة', closed: 'مغلقة' },
    },
    casesDetails: {
      title: 'تفاصيل حالات الدعم المفتوحة',
    },
    log: {
      title: 'سجل الدعم الفني',
      action: 'الإجراء',
      performedBy: 'تم بواسطة',
      timestamp: 'التوقيت',
    },
  },
};

export default support;
