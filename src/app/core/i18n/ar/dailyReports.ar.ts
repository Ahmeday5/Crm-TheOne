import { TranslationFile } from '../i18n.types';

const dailyReports: TranslationFile<'dailyReports'> = {
  dailyReports: {
    title: 'التقارير اليومية',
    subtitle: 'قم برفع تقريرك اليومي عن أعمالك وإنجازاتك',
    welcomeTitle: 'التقارير اليومية',
    welcomeSubtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    new: 'تقرير جديد',
    hours: 'ساعة',

    kpi: {
      total: 'إجمالي التقارير',
      submitted: 'التقارير المرسلة',
      reviewed: 'تمت المراجعة',
      avgHours: 'متوسط ساعات العمل',
    },

    filters: {
      search: 'بحث',
      searchPlaceholder: 'ابحث عن تقرير...',
      month: 'الشهر',
      year: 'السنة',
      scope: 'النطاق',
      allReports: 'جميع الموظفين',
      mine: 'تقاريري فقط',
    },

    empty: {
      title: 'لا توجد تقارير لهذا الشهر',
      hint: 'ابدأ بإضافة تقريرك اليومي الأول',
    },

    card: {
      details: 'التفاصيل',
      edit: 'تعديل',
      delete: 'حذف',
    },

    create: {
      title: 'إضافة تقرير يومي',
      editTitle: 'تعديل التقرير اليومي',
      submit: 'إرسال التقرير',
      editSubmit: 'حفظ التعديلات',
      cancel: 'إلغاء',
      sectionMeta: 'البيانات الأساسية',
      sectionWork: 'تفاصيل العمل',
      sectionExtra: 'ملاحظات إضافية',
      reportDate: 'تاريخ التقرير',
      workHours: 'ساعات العمل',
      completedTasks: 'المهام المُنجزة',
      completedTasksPlaceholder: 'اكتب المهام التي تم إنجازها اليوم...',
      tasksInProgress: 'مهام قيد التنفيذ',
      tasksInProgressPlaceholder: 'المهام التي لا تزال جارية...',
      plannedTasks: 'مهام مخطط لها',
      plannedTasksPlaceholder: 'المهام المخطط البدء بها قريباً...',
      challenges: 'التحديات / المعوقات',
      challengesPlaceholder: 'هل واجهت أي صعوبات؟',
      additionalNotes: 'ملاحظات إضافية',
      additionalNotesPlaceholder: 'أي ملاحظات أخرى تريد إضافتها...',
    },

    details: {
      title: 'تفاصيل التقرير اليومي',
      notFound: 'لم يتم العثور على التقرير',
      createdAt: 'تاريخ الإنشاء',
      updatedAt: 'آخر تعديل',
    },

    messages: {
      created: 'تم إرسال التقرير بنجاح',
      updated: 'تم تحديث التقرير بنجاح',
      deleted: 'تم حذف التقرير',
      loadFailed: 'تعذر تحميل التقارير',
    },

    deleteDialog: {
      title: 'حذف التقرير',
      message: 'هل أنت متأكد من حذف هذا التقرير؟ لا يمكن التراجع عن هذا الإجراء.',
      confirm: 'حذف',
      cancel: 'إلغاء',
    },
  },
};

export default dailyReports;
