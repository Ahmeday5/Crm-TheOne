import { TranslationFile } from '../i18n.types';

/** Client portal (the project owner's view) + staff answering client requests. */
const clientPortal: TranslationFile<'clientPortal'> = {
  clientPortal: {
    home: {
      title: 'مشاريعي',
      greeting: 'أهلاً',
      subtitle: 'تابع مشاريعك وقولنا لو في مشكلة أو تعديل محتاجه',
      empty: 'مفيش مشاريع مربوطة بحسابك لسه',
      emptyHint: 'لو عندك مشروع معانا ومش ظاهر هنا، كلّم مدير المشروع.',
      openRequests: 'طلب مفتوح',
      noOpenRequests: 'مفيش طلبات مفتوحة',
      open: 'افتح المشروع',
    },
    project: {
      subtitle: 'وصلنا لفين في المشروع',
      back: 'مشاريعي',
      progress: 'نسبة الإنجاز',
      done: 'مكتمل',
      status: 'الحالة',
      milestones: 'مراحل المشروع',
      started: 'بدأ في',
      expectedEnd: 'التسليم المتوقع',
      lastUpdate: 'آخر تحديث',
      updates: 'آخر التحديثات',
      noUpdates: 'مفيش تحديثات لسه',
      notFound: 'المشروع ده مش موجود أو مش متاح لحسابك',
    },
    milestone: {
      Done: 'تمت',
      InProgress: 'جاري العمل عليها',
      Pending: 'لم تبدأ بعد',
    },
    requests: {
      title: 'طلباتي',
      staffTitle: 'طلبات العميل',
      new: 'طلب جديد',
      open: 'مفتوحة',
      all: 'الكل',
      emptyOpen: 'مفيش طلبات مفتوحة',
      emptyAll: 'مفيش طلبات لسه',
      emptyHint: 'لو في مشكلة أو تعديل محتاجه، ابعته هنا والفريق هيرد عليك.',
    },
    newRequest: {
      title: 'طلب جديد',
      kind: 'نوع الطلب',
      titleLabel: 'عنوان مختصر',
      titlePlaceholder: 'مثلاً: زرار الدفع مش شغال',
      details: 'اشرح بالتفصيل',
      detailsPlaceholder: 'إيه اللي حصل؟ فين بالظبط؟ وإيه اللي كنت متوقعه؟',
      attach: 'إرفاق صور أو ملفات',
      attachHint: 'حتى 5 ملفات · 10 ميجا للملف',
      send: 'إرسال الطلب',
    },
    type: {
      Issue: 'مشكلة',
      ChangeRequest: 'تعديل',
      Question: 'استفسار',
    },
    typeHint: {
      Issue: 'حاجة مش شغالة صح',
      ChangeRequest: 'عايز تغيّر أو تضيف حاجة',
      Question: 'عندك سؤال',
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
      none: 'بدون أولوية',
      untriaged: 'محتاج تصنيف',
    },
    role: {
      Client: 'العميل',
      Staff: 'الفريق',
    },
    staff: {
      status: 'الحالة',
      priority: 'الأولوية',
    },
    thread: {
      noReplies: 'مفيش ردود لسه — الفريق هيرد قريب',
      replyPlaceholder: 'اكتب ردك… (Ctrl + Enter للإرسال)',
      send: 'إرسال',
      closed: 'الطلب ده مغلق — لو المشكلة رجعت افتح طلب جديد.',
    },
    errors: {
      send: 'تعذّر الإرسال، حاول تاني',
    },
  },
};

export default clientPortal;
