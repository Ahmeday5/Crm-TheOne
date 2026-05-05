import { TranslationFile } from '../i18n.types';

const settings: TranslationFile<'settings'> = {
  settings: {
    title: 'الإعدادات',
    subtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    tabs: {
      users: 'إدارة المستخدمين',
      roles: 'الأدوار والصلاحيات',
      system: 'إعدادات النظام',
      activity: 'سجل الأنشطة',
      audit: 'سجل التدقيق',
      notifications: 'الإشعارات والتنبيهات',
      backup: 'النسخ الاحتياطي والبيانات',
    },
    users: {
      title: 'إدارة المستخدمين',
      subtitle: 'إدارة المستخدمين وحساباتهم',
      kpi: {
        total: 'إجمالي المستخدمين',
        active: 'المستخدمون النشطون',
        inactive: 'المستخدمون غير النشطين',
        roles: 'عدد الأدوار',
      },
      filters: {
        searchPlaceholder: 'بحث بالاسم أو البريد الإلكتروني...',
        allRoles: 'جميع الأدوار',
        allStatuses: 'جميع الحالات',
        active: 'نشط',
        inactive: 'غير نشط',
      },
      list: {
        title: 'قائمة المستخدمين',
        empty: 'لا يوجد مستخدمون لعرضهم',
        col: {
          name: 'الاسم',
          role: 'الدور',
          email: 'البريد الإلكتروني',
          phone: 'الهاتف',
          status: 'الحالة',
          createdAt: 'تاريخ الإنشاء',
          actions: 'الإجراءات',
        },
      },
      add: 'إضافة مستخدم',
      edit: 'تعديل',
      delete: 'حذف',
      view: 'عرض',
      addDialog: {
        title: 'إضافة مستخدم جديد',
        fullName: 'الاسم الكامل',
        email: 'البريد الإلكتروني',
        phone: 'رقم الهاتف',
        address: 'العنوان',
        password: 'كلمة المرور',
        role: 'الدور',
        cancel: 'إلغاء',
        submit: 'إضافة',
        submitting: 'جاري الإضافة...',
      },
      editDialog: {
        title: 'تعديل بيانات المستخدم',
        cancel: 'إلغاء',
        submit: 'حفظ التغييرات',
        submitting: 'جاري الحفظ...',
      },
      deleteDialog: {
        title: 'حذف المستخدم',
        message: 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذه العملية.',
        confirm: 'حذف',
        cancel: 'إلغاء',
      },
      messages: {
        added: 'تم إضافة المستخدم بنجاح',
        updated: 'تم تحديث بيانات المستخدم بنجاح',
        deleted: 'تم حذف المستخدم بنجاح',
        loadFailed: 'تعذر تحميل قائمة المستخدمين',
      },
      placeholders: {
        notProvided: 'غير محدد',
      },
    },
    placeholder: {
      comingSoon: 'هذه الصفحة قيد التطوير، تابعونا قريباً.',
    },
  },
};

export default settings;
