import { TranslationFile } from '../i18n.types';

/** Client portal (`/portal`) + the client-request strings staff share. */
const clientPortal: TranslationFile<'clientPortal'> = {
  clientPortal: {
    nav: 'قائمة البوابة',
    logout: 'تسجيل الخروج',
    home: {
      title: 'مشاريعي',
      greeting: 'أهلاً',
      subtitle: 'تابع مشاريعك، ولو في مشكلة أو تعديل قولنا.',
      empty: 'مفيش مشاريع مربوطة بحسابك لسه',
      emptyHint: 'لو عندك مشروع معانا ومش ظاهر هنا، كلّم مدير المشروع.',
      open: 'افتح المشروع',
    },
    project: {
      back: 'مشاريعي',
      progress: 'نسبة الإنجاز',
      done: 'مكتمل',
      milestones: 'خطة المشروع',
      noMilestones: 'الخطة لسه بتتجهز',
      expectedEnd: 'التسليم المتوقع',
      lastUpdate: 'آخر تحديث',
      news: 'آخر الأخبار',
      cta: 'عندي مشكلة / طلب تعديل',
      notFound: 'المشروع ده مش موجود أو مش متاح لحسابك',
    },
    milestone: {
      Done: 'تمت',
      InProgress: 'جاري العمل عليها',
      Pending: 'لسه',
      due: 'متوقعة في',
    },
    requests: {
      title: 'طلباتي',
      staffTitle: 'طلبات العميل',
      all: 'الكل',
      openShort: 'مفتوح',
      emptyHint: 'لو في مشكلة أو تعديل محتاجه، دوس «عندي مشكلة / طلب تعديل».',
      emptyStaff: 'العميل مابعتش طلبات لسه',
      emptyFilter: 'مفيش طلبات بالحالة دي',
    },
    newRequest: {
      title: 'طلب جديد',
      kind: 'نوع الطلب',
      titleLabel: 'عنوان مختصر',
      titlePlaceholder: {
        Issue: 'مثلاً: زرار الدفع مش شغال',
        ChangeRequest: 'مثلاً: إضافة الدفع عند الاستلام',
        Question: 'مثلاً: إمتى النسخة الجاية؟',
      },
      details: 'اشرح بالتفصيل',
      detailsPlaceholder: 'إيه اللي حصل؟ فين بالظبط؟ وإيه اللي كنت متوقعه؟',
      send: 'إرسال',
    },
    attach: {
      button: 'إرفاق ملفات',
      drop: 'اسحب الصور أو الملفات هنا، أو اضغط للاختيار',
      rules: 'لحد 10 ملفات · 20 ميجا للملف · صور، PDF، أوفيس، فيديو، صوت، zip',
      clear: 'مسح المرفقات',
      skipped: {
        type: 'في ملف نوعه مش مسموح واتشال',
        size: 'في ملف أكبر من 20 ميجا واتشال',
        empty: 'في ملف فاضي واتشال',
        tooMany: 'أقصى عدد 10 ملفات',
      },
    },
    type: {
      Issue: 'مشكلة',
      ChangeRequest: 'طلب تعديل',
      Question: 'سؤال',
    },
    typeHint: {
      Issue: 'حاجة مش شغالة صح',
      ChangeRequest: 'عايز تغيّر أو تضيف حاجة',
      Question: 'عندك استفسار',
    },
    status: {
      Open: 'جديد',
      InReview: 'قيد المراجعة',
      InProgress: 'جاري التنفيذ',
      Resolved: 'تم الحل',
      Closed: 'مغلق',
    },
    priority: {
      High: 'عالية',
      Medium: 'متوسطة',
      Low: 'منخفضة',
      untriaged: 'محتاج أولوية',
    },
    role: {
      Client: 'العميل',
      Admin: 'الإدارة',
      Developer: 'المطور',
      Team: 'الفريق',
    },
    staff: {
      status: 'الحالة',
      priority: 'الأولوية',
      assignee: 'المسؤول',
      unassigned: 'بدون مسؤول',
    },
    thread: {
      you: 'أنت',
      noRepliesClient: 'وصلنا طلبك — الفريق هيرد عليك قريب',
      noRepliesStaff: 'مفيش ردود لسه — ابدأ بالرد على العميل',
      replyPlaceholder: 'اكتب ردك… (Ctrl + Enter للإرسال)',
      send: 'إرسال',
      closed: 'الطلب ده مغلق — لو المشكلة رجعت ابعت طلب جديد.',
      reopenHint: 'الطلب اتحل. لو المشكلة لسه موجودة رد هنا وهيرجع للمراجعة.',
    },
    errors: {
      load: 'تعذّر تحميل البيانات',
      requestNotFound: 'الطلب ده مش موجود أو مش متاح لحسابك',
    },
  },
};

export default clientPortal;
