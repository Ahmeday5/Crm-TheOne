import { TranslationFile } from '../i18n.types';

/** Project workspace: team allocation + build archive (APK + auto git push). */
const projectWorkspace: TranslationFile<'projectWorkspace' | 'projectTeam' | 'projectBuilds'> = {
  projectWorkspace: {
    status: 'الحالة',
    progress: 'نسبة الإنجاز',
    team: 'الفريق',
    client: 'العميل',
    loadFailed: 'تعذّر تحميل المشروع',
  },
  projectTeam: {
    title: 'الفريق والنسب',
    edit: 'تعديل الفريق',
    addDeveloper: 'إضافة مطور',
    addFirst: 'أضف أول مطور',
    pickDeveloper: 'اختر مطوراً…',
    remove: 'إزالة',
    distribute: 'توزيع متساوٍ',
    rolePlaceholder: 'الدور (مثلاً Backend)',
    noRole: 'بدون دور محدد',
    tasksProgress: 'تقدّم المهام',
    overBudget: 'مجموع النسب تعدّى 100% — عدّل القيم قبل الحفظ.',
    emptyTitle: 'لا يوجد مطورون على المشروع',
    emptyHint: 'أضف المطورين وحدّد نسبة كل واحد من الشغل.',
  },
  projectBuilds: {
    title: 'النسخ (Builds)',
    latest: 'آخر نسخة',
    publish: 'نشر نسخة',
    download: 'تحميل الملف',
    downloadMock: 'تحميل الملف (غير متاح في المعاينة)',
    you: 'أنت',
    emptyTitle: 'لا توجد نسخ منشورة',
    emptyHint: 'انشر أول نسخة — الملف يُرفع والكود يُدفع تلقائياً على GitHub.',
    status: {
      pending: 'في الانتظار',
      uploading: 'جاري الرفع',
      pushed: 'تم الدفع',
      failed: 'فشل',
    },
    platform: {
      Android: 'أندرويد',
      iOS: 'آيفون',
      Web: 'ويب',
      Backend: 'الخادم',
      Other: 'أخرى',
    },
    col: {
      version: 'النسخة',
      platform: 'المنصة',
      developer: 'المطور',
      artifact: 'الملف',
      git: 'GitHub',
      status: 'الحالة',
      date: 'التاريخ',
    },
    composer: {
      title: 'نشر نسخة جديدة',
      version: 'رقم النسخة',
      platform: 'المنصة',
      artifact: 'ملف النسخة (APK/حزمة)',
      pickFile: 'اختر ملف النسخة',
      gitHint: 'الكود هيترفع تلقائياً على GitHub الشركة ويتربط بالنسخة.',
      notes: 'ملاحظات النسخة',
      notesPlaceholder: 'إيه اللي اتغيّر في النسخة دي؟',
      publish: 'نشر النسخة',
    },
  },
};

export default projectWorkspace;
