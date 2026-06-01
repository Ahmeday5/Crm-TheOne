import { TranslationFile } from '../i18n.types';

const resources: TranslationFile<'resources'> = {
  resources: {
    welcomeTitle: 'الموارد',
    welcomeSubtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    title: 'إدارة الموارد وأعباء العمل',
    subtitle: 'متابعة أحمال العمل وتوزيع المهام بكفاءة.',
    export: 'تصدير التقرير',
    kpi: {
      totalDevelopers: 'إجمالي المطورين',
      avgWorkload: 'متوسط حمل العمل',
      overloaded: 'مطورون محمّلون',
      available: 'مطورون متاحون',
    },
    filters: {
      search: 'بحث',
      searchPlaceholder: 'ابحث باسم المطوّر…',
      project: 'المشروع',
      allProjects: 'الكل',
      priority: 'الأولوية',
      allPriorities: 'الكل',
      sortBy: 'ترتيب حسب',
      reset: 'إعادة تعيين',
    },
    sort: {
      WorkloadDesc: 'حمل العمل (الأعلى أولاً)',
      WorkloadAsc: 'حمل العمل (الأقل أولاً)',
      TasksDesc: 'المهام (الأكثر أولاً)',
      NameAsc: 'الاسم (أ–ي)',
    },
    team: {
      title: 'نظرة عامة على الفريق',
      tasksLabel: 'مهمة',
      availableOf: 'ساعة متاحة من',
      workload: 'حمل العمل',
      empty: 'لا يوجد مطورون مطابقون للفلاتر الحالية.',
    },
    distribution: {
      title: 'توزيع أحمال العمل',
      tasksLabel: 'مهام',
      empty: 'لا توجد بيانات أحمال عمل لعرضها بعد.',
    },
    table: {
      developer: 'المطوّر',
      specialty: 'التخصص',
      tasks: 'المهام',
      usedHours: 'الساعات المستخدمة',
      availableHours: 'الساعات المتاحة',
      capacity: 'السعة (ساعة)',
      workload: 'حمل العمل',
    },
    messages: {
      loadFailed: 'تعذّر تحميل بيانات الموارد',
      nothingToExport: 'لا توجد بيانات للتصدير',
    },
  },
};

export default resources;
