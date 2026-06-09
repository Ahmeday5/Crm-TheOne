import { TranslationFile } from '../i18n.types';

const tableTools: TranslationFile<'tableTools'> = {
  tableTools: {
    refresh: 'تحديث',
    label: 'تصدير / طباعة',
    excel: 'تصدير إلى Excel',
    print: 'طباعة (PDF)',
    exportCurrent: 'الصفحة الحالية',
    exportAll: 'كل الصفحات',
    printCurrent: 'الصفحة الحالية',
    printAll: 'كل الصفحات',
    generatedAt: 'تاريخ الإصدار',
    total: 'الإجمالي',
    scope: {
      current: 'الصفحة الحالية',
      all: 'كل الصفحات',
    },
    messages: {
      noData: 'لا توجد بيانات للتصدير.',
      fetchAllFailed: 'تعذّر تحميل كل الصفحات. حاول مرة أخرى.',
      exportFailed: 'فشل التصدير. حاول مرة أخرى.',
      popupBlocked: 'يُرجى السماح بالنوافذ المنبثقة لطباعة التقرير.',
    },
  },
};

export default tableTools;
