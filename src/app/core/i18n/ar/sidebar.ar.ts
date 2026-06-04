import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    search: 'ابحث في القائمة...',
    collapse: 'تصغير القائمة',
    expand: 'تكبير القائمة',
    sections: {
      role: 'اختر الدور',
      marketingSales: 'التسويق والمبيعات',
      mainModules: 'الوحدات الرئيسية',
      system: 'إدارة النظام',
      contracts: 'العقود والمواعيد',
      performance: 'الأداء والتحفيز',
      security: 'الأمن',
    },
    items: {
      // Roles
      admin: 'المدير / المالك',
      marketing: 'التسويق',
      sales: 'المبيعات',
      support: 'الدعم الفني',
      developers: 'المطورين',
      // Marketing & sales
      campaigns: 'الحملات التسويقية',
      salesAnalysis: 'تحليل نتائج المبيعات',
      // Main modules
      leads: 'إدارة العملاء المحتملين',
      salesCustomers: 'عملاء المبيعات',
      salesLine: 'خط المبيعات',
      projects: 'المشاريع والمهام',
      reports: 'التقارير والتحليلات',
      chat: 'الدردشة الداخلية',
      dailyReports: 'التقارير اليومية',
      whatsappSessions: 'جلسات واتساب',
      // System administration
      settings: 'إعدادات النظام',
      services: 'إدارة الخدمات',
      kb: 'قاعدة المعرفة',
      improvements: 'تحسينات النظام',
      resources: 'إدارة الموارد',
      notifications: 'مركز الإشعارات',
      devAnalytics: 'تحليلات المطورين',
      webhooks: 'إدارة الويبهوكس',
      // Contracts & schedule
      contractsManage: 'إدارة العقود',
      schedule: 'جدول المواعيد',
      // Performance
      goals: 'الأهداف والتحفيز',
      // Security
      mfa: 'التحقق متعدد العوامل',
    },
  },
};

export default sidebar;
