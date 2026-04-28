import { TranslationFile } from '../i18n.types';

const reportAnalysis: TranslationFile<'reportAnalysis'> = {
  reportAnalysis: {
    title: 'التقارير والتحليلات',
    subtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    tabs: {
      panel: 'لوحة التقاير',
      empReport: 'تقارير الموظفين',
      marketingReport: 'تقارير التسويق',
      salesReport: 'تقارير المبيعات',
      appReport: 'تقارير الدعم الفني',
      projectReport: 'تقارير المشاريع',
      customReport: 'تقارير مخصصة',
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

export default reportAnalysis;
