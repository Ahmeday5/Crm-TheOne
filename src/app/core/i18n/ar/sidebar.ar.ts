import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    navLabel: 'القائمة الرئيسية',
    search: 'ابحث في القائمة...',
    clearSearch: 'مسح البحث',
    noResults: 'لا توجد صفحات مطابقة',
    collapse: 'تصغير القائمة',
    expand: 'تكبير القائمة',
    close: 'إغلاق القائمة',
    sections: {
      overview: 'نظرة عامة',
      departments: 'الأقسام',
      developers: 'المطورين',
      reports: 'التقارير والتحليلات',
      marketingSales: 'التسويق والمبيعات',
      operations: 'التشغيل',
      communication: 'التواصل',
      performance: 'الأداء والتقارير',
      system: 'إدارة النظام',
      // Kept for older references.
      role: 'اختر الدور',
      mainModules: 'الوحدات الرئيسية',
      contracts: 'العقود والمواعيد',
      security: 'الأمن',
    },
    groups: {
      dashboards: 'لوحات التحكم',
      marketing: 'التسويق',
      sales: 'المبيعات',
      contracts: 'العقود والمواعيد',
      support: 'الدعم الفني',
      development: 'المطورين',
      reports: 'التقارير والتحليلات',
      chats: 'المحادثات',
      announcements: 'الإعلانات والإشعارات',
      goals: 'الأهداف والتحفيز',
    },
    items: {
      // Dashboards
      adminDashboard: 'لوحة تحكم المدير',
      attendance: 'الحضور والإجازات',
      marketingDashboard: 'لوحة التسويق',
      salesDashboard: 'لوحة المبيعات',
      supportDashboard: 'لوحة الدعم الفني',
      developersDashboard: 'لوحة المطورين',
      admin: 'المدير / المالك',
      marketing: 'التسويق',
      sales: 'المبيعات',
      support: 'الدعم الفني',
      developers: 'المطورين',
      // Marketing
      leads: 'العملاء المحتملين',
      campaigns: 'الحملات التسويقية',
      salesAnalysis: 'تحليل نتائج المبيعات',
      smartAnalytics: 'التحليلات الذكية',
      // Sales
      salesCustomers: 'عملاء المبيعات',
      salesPipeline: 'مسار المبيعات (Kanban)',
      priceOffers: 'عروض الأسعار',
      salesPlaybook: 'دليل المبيعات',
      salesLine: 'عروض الأسعار',
      // Contracts & schedule
      contractsManage: 'إدارة العقود',
      schedule: 'جدول المواعيد',
      // Operations
      supportClients: 'عملاء الدعم',
      kb: 'قاعدة المعرفة',
      projects: 'المشاريع والمهام',
      devAnalytics: 'تحليلات المطورين',
      myProjectReports: 'تقاريري',
      // Communication
      whatsapp: 'واتساب العملاء',
      teamChat: 'الدردشة الداخلية',
      whatsappNumbers: 'إعدادات واتساب',
      announcements: 'لوحة الإعلانات',
      notifications: 'مركز الإشعارات',
      chat: 'الدردشة الداخلية',
      // Performance
      dailyReports: 'التقارير اليومية',
      goals: 'الأهداف',
      leaderboard: 'لوحة المتصدرين',
      // System
      settings: 'إعدادات النظام',
      services: 'إدارة الخدمات',
      resources: 'إدارة الموارد',
      // Not in the menu right now
      reports: 'التقارير والتحليلات',
      improvements: 'تحسينات النظام',
      webhooks: 'إدارة الويبهوكس',
      mfa: 'التحقق متعدد العوامل',
    },
  },
};

export default sidebar;
