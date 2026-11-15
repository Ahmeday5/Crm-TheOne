import { TranslationFile } from '../i18n.types';

/** Customer-map page strings (shared map strings live in `geo`). */
const customerMap: TranslationFile<'customerMap'> = {
  customerMap: {
    title: 'خريطة العملاء',
    subtitleAdmin: 'عملاءك موزعين إزاي على الدول والمحافظات — على خريطة حقيقية',
    subtitleSales: 'عملاءك إنت موزعين إزاي على الدول والمحافظات — على خريطة حقيقية',
    unit: 'عميل',
    loadFailed: 'تعذّر تحميل بيانات الخريطة.',
    empty: 'مفيش عملاء مطابقين للفلاتر دي',
    emptyHint: 'جرّب توسّع الفترة أو تشيل بعض الفلاتر.',
    filters: {
      title: 'فلاتر الخريطة',
      all: 'الكل',
      status: 'الحالة',
      source: 'المصدر',
      campaign: 'الحملة',
      service: 'الخدمة',
      salesPerson: 'مندوب المبيعات',
      allSalesPeople: 'كل المناديب',
      createdBetween: 'تاريخ إضافة العميل',
      from: 'من',
      to: 'إلى',
      reset: 'مسح الفلاتر',
      presets: {
        '30d': 'آخر 30 يوم',
        '90d': 'آخر 3 شهور',
        year: 'السنة دي',
        all: 'كل الفترات',
      },
    },
    kpi: {
      total: 'إجمالي العملاء',
      countries: 'عدد الدول',
      located: 'دولتهم معروفة',
      unknown: 'دولة غير معروفة',
      unknownSub: 'بدون رقم أو كود دولة',
      unknownAria: 'عرض العملاء اللي دولتهم غير معروفة',
    },
    panel: {
      customerList: 'العملاء',
      openList: 'فتح في جدول العملاء',
      loadFailed: 'تعذّر تحميل العملاء.',
      noCustomers: 'مفيش عملاء هنا.',
      filtersNote: 'القائمة دي بتطبّق فلتر الحالة والمصدر بس — الحملة والخدمة والتاريخ والمندوب بيأثروا على أرقام الخريطة فقط.',
    },
  },
};

export default customerMap;
