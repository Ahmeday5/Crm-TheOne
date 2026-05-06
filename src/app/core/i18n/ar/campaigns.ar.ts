import { TranslationFile } from '../i18n.types';

const campaigns: TranslationFile<'campaigns'> = {
  campaigns: {
    title: 'إدارة الحملات التسويقية',
    subtitle: 'أنشئ وأدر حملاتك التسويقية عبر جميع المنصات',
    welcomeTitle: 'إدارة الحملات',
    welcomeSubtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    new: 'إنشاء حملة جديدة',
    sar: 'ج.م',
    days: 'يوم',

    kpi: {
      totalBudget: 'إجمالي الميزانية',
      spent: 'تم الإنفاق',
      active: 'الحملات النشطة',
      remaining: 'المتبقي',
    },

    filters: {
      searchPlaceholder: 'ابحث عن حملة...',
      allStatuses: 'جميع الحالات',
      allPlatforms: 'جميع المنصات',
    },

    status: {
      active: 'نشطة',
      notactive: 'متوقفة',
      completed: 'مكتملة',
      cancelled: 'ملغاة',
    },

    targeting: {
      ageLabel: 'العمر',
    },

    card: {
      totalBudget: 'الميزانية الإجمالية',
      dailyBudget: 'الميزانية اليومية',
      audience: 'الجمهور المستهدف',
      details: 'التفاصيل',
      pause: 'إيقاف',
      resume: 'تشغيل',
      delete: 'حذف',
      empty: 'لا توجد حملات مطابقة لمعايير البحث',
    },

    create: {
      title: 'إنشاء حملة تسويقية جديدة',
      sectionInfo: 'المعلومات الأساسية',
      sectionBudget: 'الميزانية والمدة',
      sectionAudience: 'الجمهور المستهدف',
      name: 'اسم الحملة',
      namePlaceholder: 'مثال: حملة الصيف الكبرى',
      description: 'الوصف',
      descriptionPlaceholder: 'وصف مختصر عن الحملة وأهدافها...',
      platform: 'المنصة',
      platformPlaceholder: 'اختر المنصة الإعلانية',
      addChannelSource: 'إضافة منصة جديدة',
      status: 'حالة الحملة',
      statusHint: 'الحالة الافتراضية نشطة',
      budget: 'الميزانية الإجمالية (ج.م)',
      duration: 'مدة الحملة (أيام)',
      durationHint: 'تُحسب تلقائيًا من تاريخ البداية والنهاية',
      startDate: 'تاريخ البداية',
      endDate: 'تاريخ النهاية',
      minAge: 'الحد الأدنى للعمر',
      maxAge: 'الحد الأقصى للعمر',
      gender: 'الجنس',
      countries: 'الدول المستهدفة',
      countriesPlaceholder: 'مثال: 1, 2, 3',
      countriesHint: 'أدخل أرقام معرفات الدول مفصولة بفواصل',
      cancel: 'إلغاء',
      submit: 'إنشاء الحملة',
      genders: {
        all: 'الكل',
        male: 'ذكر',
        female: 'أنثى',
      },
      errors: {
        endBeforeStart: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
        ageRangeInvalid: 'الحد الأقصى للعمر يجب ألا يقل عن الحد الأدنى',
      },
      invalidDuration: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
    },

    details: {
      title: 'تفاصيل الحملة',
      notFound: 'لم يتم العثور على بيانات الحملة',
      platformUnknown: 'منصة غير محددة',
      budget: 'الميزانية',
      remaining: 'المتبقي',
      duration: 'المدة',
      daysElapsed: 'الأيام المنقضية',
      daysRemaining: 'الأيام المتبقية',
      spentProgress: 'نسبة الإنفاق',
    },

    channelSource: {
      title: 'إضافة منصة إعلانية',
      name: 'اسم المنصة',
      namePlaceholder: 'مثال: Facebook',
      submit: 'إضافة المنصة',
      created: 'تمت إضافة المنصة بنجاح',
    },

    messages: {
      created: 'تم إنشاء الحملة بنجاح',
      paused: 'تم إيقاف الحملة',
      resumed: 'تم تشغيل الحملة',
      deleted: 'تم حذف الحملة',
      loadFailed: 'تعذر تحميل قائمة الحملات',
    },

    deleteDialog: {
      title: 'حذف الحملة',
      message:
        'هل أنت متأكد من حذف هذه الحملة؟ لا يمكن التراجع عن هذا الإجراء.',
      confirm: 'حذف',
      cancel: 'إلغاء',
    },

    toggleDialog: {
      pauseTitle: 'إيقاف الحملة',
      pauseMessage: 'هل تريد إيقاف هذه الحملة؟ يمكنك تشغيلها مرة أخرى لاحقاً.',
      resumeTitle: 'تشغيل الحملة',
      resumeMessage: 'هل تريد تشغيل هذه الحملة؟',
      pauseConfirm: 'إيقاف',
      resumeConfirm: 'تشغيل',
      cancel: 'إلغاء',
    },
  },
};

export default campaigns;
