import { TranslationFile } from '../i18n.types';

const services: TranslationFile<'services'> = {
  services: {
    title: 'إدارة الخدمات',
    subtitle: 'أنشئ وأدر الخدمات المقدمة للعملاء',
    welcomeTitle: 'إدارة الخدمات',
    welcomeSubtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    new: 'إضافة خدمة جديدة',

    kpi: {
      total: 'إجمالي الخدمات',
      page: 'الصفحة الحالية',
      pageSize: 'عدد الصفوف',
      visible: 'الخدمات المعروضة',
    },

    filters: {
      searchPlaceholder: 'ابحث عن خدمة بالاسم...',
    },

    table: {
      id: 'المعرّف',
      nameAr: 'الاسم بالعربية',
      nameEn: 'الاسم بالإنجليزية',
      empty: 'لا توجد خدمات لعرضها — أضف أول خدمة لتظهر هنا.',
      emptyFiltered: 'لا توجد خدمات مطابقة لكلمة البحث.',
      edit: 'تعديل',
      delete: 'حذف',
    },

    form: {
      addTitle: 'إضافة خدمة جديدة',
      editTitle: 'تعديل الخدمة',
      viewTitle: 'تفاصيل الخدمة',
      nameAr: 'الاسم بالعربية',
      nameArPlaceholder: 'مثال: تطبيق موبيل',
      nameEn: 'الاسم بالإنجليزية',
      nameEnPlaceholder: 'مثال: Mobile Application',
      cancel: 'إلغاء',
      submitAdd: 'إضافة الخدمة',
      submitEdit: 'حفظ التعديلات',
    },

    messages: {
      added: 'تمت إضافة الخدمة بنجاح',
      updated: 'تم تحديث الخدمة بنجاح',
      deleted: 'تم حذف الخدمة بنجاح',
      loadFailed: 'تعذر تحميل قائمة الخدمات',
    },

    deleteDialog: {
      title: 'حذف الخدمة',
      message: 'هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع عن هذا الإجراء.',
      confirm: 'حذف',
      cancel: 'إلغاء',
    },
  },
};

export default services;
