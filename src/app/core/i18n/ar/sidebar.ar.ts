import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    search: 'ابحث في القائمة...',
    collapse: 'تصغير القائمة',
    expand: 'تكبير القائمة',
    sections: {
      role: 'اختر الدور',
      modules: 'الوحدات المتاحة',
      system: 'إدارة النظام',
    },
    items: {
      admin: 'المدير / المالك',
      marketing: 'التسويق',
      sales: 'المبيعات',
      support: 'الدعم الفني',
      developers: 'المطورين',
      leads: 'إدارة العملاء المحتملين',
      salesLine: 'خط المبيعات',
      projects: 'المشاريع والمهام',
      reports: 'التقارير والتحليلات',
      chat: 'الدردشة الداخلية',
      users: 'إدارة المستخدمين',
      settings: 'إعدادات النظام',
      kb: 'قاعدة المعرفة',
      improvements: 'تحسينات النظام',
      advanced: 'الميزات المتقدمة',
      notifications: 'مركز الإشعارات',
    },
  },
};

export default sidebar;
