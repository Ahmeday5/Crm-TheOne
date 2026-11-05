import { TranslationFile } from '../i18n.types';

const pipeline: TranslationFile<'pipeline'> = {
  pipeline: {
    title: 'مسار المبيعات',
    subtitleAdmin: 'كل عملاء فريق المبيعات موزعين حسب المرحلة',
    subtitleSales: 'عملاؤك موزعين حسب المرحلة',
    view: {
      label: 'طريقة العرض',
      table: 'جدول',
      kanban: 'Kanban',
    },
    stats: {
      total: 'إجمالي العملاء',
      inProgress: 'قيد العمل',
      buyers: 'تم الشراء',
      closeRate: 'نسبة الإغلاق',
      closeRateHint: 'مشتري ÷ (مشتري + غير مشتري)',
    },
    filters: {
      search: 'ابحث بالاسم أو رقم الهاتف...',
      allSources: 'جميع المصادر',
      allServices: 'كل الخدمات',
      allSales: 'كل المناديب',
    },
    toolbar: {
      overdueOnly: 'المتابعات المستحقة فقط',
      sort: 'ترتيب',
      stale: 'متأخر بعد',
      staleHint: 'عدد الأيام في نفس المرحلة الذي يُعتبر بعده العميل متأخراً',
      staleDefault: 'الافتراضي',
      staleDays: '{days} يوم',
      clear: 'مسح الفلاتر',
      dragHint: 'اسحب أي كارت لعمود آخر لتغيير حالة العميل، أو استخدم زر تغيير الحالة.',
      refresh: 'تحديث',
    },
    sort: {
      Newest: 'الأحدث إضافة',
      Oldest: 'الأقدم إضافة',
      StageAge: 'الأطول في المرحلة',
      NextFollowUp: 'أقرب متابعة',
    },
    card: {
      enteredToday: 'دخل المرحلة اليوم',
      daysInStage: '{days} يوم في المرحلة',
      stale: 'متأخر',
      followUp: 'المتابعة القادمة',
      followUpOverdue: 'متابعة متأخرة',
      unassigned: 'غير معيّن',
      changeStatus: 'تغيير الحالة',
      whatsapp: 'واتساب',
      call: 'اتصال',
      view: 'عرض التفاصيل',
    },
    partial: 'يتم عرض {shown} من أصل {total} عميل — استخدم البحث أو الفلاتر أو "تحميل المزيد" داخل كل عمود.',
    loadMore: 'تحميل المزيد ({left})',
    columnEmpty: 'لا يوجد عملاء في هذه المرحلة',
    empty: 'لا يوجد عملاء في المسار بعد.',
    emptyFiltered: 'لا توجد نتائج مطابقة للفلاتر الحالية.',
    messages: {
      loadFailed: 'تعذر تحميل مسار المبيعات — يرجى المحاولة مجددًا.',
      moved: 'تم نقل {name} إلى "{stage}" ✓',
      moveFailed: 'تعذر تغيير حالة العميل.',
    },
  },
};

export default pipeline;
