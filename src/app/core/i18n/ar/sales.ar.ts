import { TranslationFile } from '../i18n.types';

const sales: TranslationFile<'sales'> = {
  sales: {
    title: 'خط المبيعات',
    subtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    tabs: {
      line: 'خط المبيعات',
      priceOffers: 'عروض الأسعار',
      contracts: 'العقود',
      followUps: 'المتابعات',
    },
    lostBanner: {
      title: 'تتبع الصفقات المفقودة',
      stage: 'صفقات مفقودة (لم تكتمل)',
      desc: 'عند نقل أي عميل إلى مرحلة الصفقات المفقودة، يتم تلقائياً تسجيل بياناته مع سبب عدم الشراء وإرسالها إلى قسم التسويق.',
      analysisTitle: 'كيف يظهر في تحليل نتائج المبيعات:',
      a1: 'يتم إدراج العميل في قائمة "العملاء غير المشترين"',
      a2: 'يظهر سبب عدم إتمام الصفقة بوضوح للتحليل',
      a3: 'يمكن لفريق التسويق تحليل الأسباب لتحسين الحملات المستقبلية',
      a4: 'البيانات تساعد في فهم نقاط الضعف وتطوير استراتيجيات أفضل',
    },
    line: {
      title: 'خط المبيعات',
      subtitle: 'متابعة الصفقات في كل مرحلة',
      pipeline: 'الأنبوب',
      stages: {
        prospecting: 'استكشاف',
        qualified: 'مؤهلون',
        proposal: 'عرض',
        negotiation: 'تفاوض',
        closed: 'مغلق',
      },
    },
    priceOffers: {
      title: 'عروض الأسعار',
      add: 'إضافة عرض سعر',
      number: 'رقم العرض',
      client: 'العميل',
      total: 'الإجمالي',
      validUntil: 'صالح حتى',
    },
    contracts: {
      title: 'العقود',
      number: 'رقم العقد',
      startDate: 'تاريخ البداية',
      endDate: 'تاريخ النهاية',
      value: 'قيمة العقد',
    },
    followUps: {
      title: 'المتابعات',
      next: 'المتابعة القادمة',
      previous: 'المتابعة السابقة',
      type: 'نوع المتابعة',
    },
    deal: {
      details: 'تفاصيل الصفقة',
      stage: 'المرحلة',
      value: 'قيمة الصفقة',
      probability: 'احتمالية الإغلاق',
      expectedClose: 'تاريخ الإغلاق المتوقع',
      owner: 'المسؤول',
      timeline: 'الجدول الزمني',
      activities: 'الأنشطة',
      attachments: 'المرفقات',
    },
  },
};

export default sales;
