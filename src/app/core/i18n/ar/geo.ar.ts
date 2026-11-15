import { TranslationFile } from '../i18n.types';

/** Shared strings of the geographic maps (customers, support tickets). */
const geo: TranslationFile<'geo'> = {
  geo: {
    updating: 'جاري التحديث…',
    unknownCountry: 'دولة غير معروفة',
    noGovernorate: 'بدون محافظة',
    map: {
      levels: 'مستوى الخريطة',
      world: 'العالم',
      egypt: 'مصر',
      back: 'رجوع لخريطة العالم',
      openEgypt: 'محافظات مصر',
      allEgypt: 'كل مصر',
      hint: 'اضغط على دولة أو محافظة للتفاصيل · Ctrl + عجلة الماوس للتكبير',
      noShapes: 'حدود المناطق مش متاحة دلوقتي — بنعرض الأماكن كنقاط.',
      unavailable: 'الخريطة مش متاحة على الجهاز ده (المتصفح مش بيدعم WebGL). القائمة شغالة عادي.',
      listView: 'القائمة',
      mapView: 'الخريطة',
      worldAria: 'خريطة العالم ملوّنة حسب عدد {unit} في {n} دولة',
      egyptAria: 'خريطة محافظات مصر ملوّنة حسب عدد {unit} في {n} محافظة',
    },
    legend: {
      title: 'العدد',
    },
    tooltip: {
      ofTotal: 'من الإجمالي',
      ofEgypt: 'من إجمالي مصر',
      inferred: '{n} من رقم الموبايل',
      click: 'اضغط للتفاصيل',
      clickEgypt: 'اضغط لعرض المحافظات',
    },
    ranking: {
      title: 'ترتيب المناطق',
      count: 'العدد',
      inferred: 'تلقائي',
      inferredHint: 'عدد العملاء اللي دولتهم اتحددت من رقم الموبايل',
      empty: 'مفيش بيانات',
      countries: 'ترتيب الدول',
      governorates: 'ترتيب المحافظات',
      country: 'الدولة',
      governorate: 'المحافظة',
    },
    panel: {
      shareOfTotal: 'من الإجمالي',
      shareOfEgypt: 'من إجمالي مصر',
      inferred: 'من رقم الموبايل',
      byStatus: 'حسب الحالة',
      unknownHint: 'عملاء مالهمش رقم موبايل أو رقمهم من غير كود دولة. حدّد الدولة من تعديل العميل.',
      noGovernorateHint: 'عملاء في مصر لسه ماتحددش محافظتهم. حدّدها من تعديل العميل.',
    },
  },
};

export default geo;
