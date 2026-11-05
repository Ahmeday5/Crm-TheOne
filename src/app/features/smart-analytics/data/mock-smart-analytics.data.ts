import { SourceChannel, TicketPriority } from '../models/smart-analytics.models';

/*
 * Reference tables for the mock adapter — realistic Egyptian sample data.
 * Rates are per-source *tendencies*; the seeded generator adds noise around
 * them so every range/month looks a little different but never random.
 */

export interface SourceSeed {
  id: string;
  name: string;
  channel: SourceChannel;
  /** Typical new customers per 30 days. */
  monthly: number;
  /** Typical conversion (0–1). */
  conversion: number;
}

export const SOURCE_SEEDS: ReadonlyArray<SourceSeed> = [
  { id: 'src-facebook', name: 'إعلانات فيسبوك', channel: 'facebook', monthly: 160, conversion: 0.085 },
  { id: 'src-tiktok', name: 'تيك توك', channel: 'tiktok', monthly: 95, conversion: 0.045 },
  { id: 'src-instagram', name: 'إنستجرام', channel: 'instagram', monthly: 85, conversion: 0.07 },
  { id: 'src-google', name: 'إعلانات جوجل', channel: 'google', monthly: 70, conversion: 0.14 },
  { id: 'src-whatsapp', name: 'واتساب', channel: 'whatsapp', monthly: 60, conversion: 0.16 },
  { id: 'src-website', name: 'الموقع الإلكتروني', channel: 'website', monthly: 40, conversion: 0.12 },
  { id: 'src-referral', name: 'ترشيحات العملاء', channel: 'referral', monthly: 22, conversion: 0.31 },
  { id: 'src-walkin', name: 'زيارة الفرع', channel: 'walkIn', monthly: 14, conversion: 0.38 },
  { id: 'src-other', name: 'أخرى', channel: 'other', monthly: 6, conversion: 0.06 },
];

export const CAMPAIGN_SEEDS: ReadonlyArray<SourceSeed> = [
  { id: 'cmp-ramadan', name: 'حملة رمضان كريم', channel: 'facebook', monthly: 140, conversion: 0.09 },
  { id: 'cmp-white-friday', name: 'عروض الجمعة البيضاء', channel: 'facebook', monthly: 120, conversion: 0.11 },
  { id: 'cmp-tiktok-summer', name: 'تحدي تيك توك الصيفي', channel: 'tiktok', monthly: 90, conversion: 0.035 },
  { id: 'cmp-influencer', name: 'تعاون مع إنفلونسر — إنستجرام', channel: 'instagram', monthly: 60, conversion: 0.06 },
  { id: 'cmp-google-search', name: 'جوجل — إعلانات البحث', channel: 'google', monthly: 55, conversion: 0.16 },
  { id: 'cmp-back-to-school', name: 'حملة العودة للمدارس', channel: 'instagram', monthly: 45, conversion: 0.08 },
  { id: 'cmp-retargeting', name: 'ريتارجتنج زوار الموقع', channel: 'facebook', monthly: 38, conversion: 0.19 },
  { id: 'cmp-whatsapp-winback', name: 'واتساب — استرجاع العملاء القدامى', channel: 'whatsapp', monthly: 30, conversion: 0.24 },
  { id: 'cmp-refer-friend', name: 'برنامج «رشّح صاحبك»', channel: 'referral', monthly: 18, conversion: 0.33 },
];

/** Calls per (day, hour) bucket per 30 days, by hour 9…20. */
export const HOURLY_CALL_VOLUME: Readonly<Record<number, number>> = {
  9: 8, 10: 14, 11: 20, 12: 22, 13: 20, 14: 16, 15: 15, 16: 17, 17: 18, 18: 16, 19: 14, 20: 10,
};

/** Baseline answer probability by hour — late morning and evening peaks, afternoon dip. */
export const HOURLY_ANSWER_RATE: Readonly<Record<number, number>> = {
  9: 0.36, 10: 0.48, 11: 0.6, 12: 0.63, 13: 0.54, 14: 0.4, 15: 0.36, 16: 0.44, 17: 0.53, 18: 0.6, 19: 0.68, 20: 0.62,
};

/** Day modifiers (0 = Saturday … 6 = Friday): volume multiplier and answer-rate shift. */
export const DAY_PROFILE: ReadonlyArray<{ volume: number; shift: number }> = [
  { volume: 1, shift: 0 }, // السبت
  { volume: 1.05, shift: 0.03 }, // الأحد
  { volume: 1, shift: 0.02 }, // الاثنين
  { volume: 1, shift: 0.05 }, // الثلاثاء
  { volume: 0.95, shift: 0 }, // الأربعاء
  { volume: 0.85, shift: -0.04 }, // الخميس
  { volume: 0.35, shift: -0.06 }, // الجمعة
];

export interface RepSeed {
  id: string;
  name: string;
  /** Typical calls per full month. */
  calls: number;
  answer: number;
  close: number;
}

export const REP_SEEDS: ReadonlyArray<RepSeed> = [
  { id: 'rep-ahmed-samir', name: 'أحمد سمير', calls: 410, answer: 0.64, close: 0.13 },
  { id: 'rep-menna-khaled', name: 'منة الله خالد', calls: 360, answer: 0.71, close: 0.17 },
  { id: 'rep-mahmoud-aziz', name: 'محمود عبد العزيز', calls: 450, answer: 0.55, close: 0.09 },
  { id: 'rep-sara-elsherif', name: 'سارة الشريف', calls: 330, answer: 0.68, close: 0.2 },
  { id: 'rep-youssef-hamdy', name: 'يوسف حمدي', calls: 280, answer: 0.58, close: 0.11 },
  { id: 'rep-nourhan-adel', name: 'نورهان عادل', calls: 390, answer: 0.66, close: 0.15 },
  { id: 'rep-karim-fathy', name: 'كريم فتحي', calls: 240, answer: 0.52, close: 0.08 },
];

/** Sample admin notes for seeded reviews of past months, by star rating. */
export const REVIEW_NOTES: Readonly<Record<number, ReadonlyArray<string>>> = {
  5: [
    'أداء ممتاز ومتابعة منتظمة مع العملاء — استمر على نفس المستوى.',
    'أعلى نسبة إغلاق في الفريق، شكرًا على المجهود.',
  ],
  4: [
    'شغل كويس جدًا، محتاج تركيز أكتر على المتابعة بعد أول مكالمة.',
    'التزام واضح بالأهداف، نحاول نرفع نسبة الرد الشهر الجاي.',
  ],
  3: [
    'مستوى مقبول، فيه فرص ضايعة بسبب التأخير في الرد على العملاء.',
    'عدد المكالمات كويس لكن نسبة الإغلاق محتاجة تتحسن.',
  ],
  2: ['الأرقام أقل من المتوقع — هنعمل جلسة متابعة أسبوعية.'],
  1: ['محتاجين خطة تحسين واضحة للشهر الجاي.'],
};

export const CUSTOMER_NAMES: ReadonlyArray<string> = [
  'محمد عبد الرحمن', 'فاطمة حسن', 'عمر الفاروق', 'هبة مصطفى', 'مصطفى كامل', 'ياسمين طارق',
  'خالد إبراهيم', 'دينا سعيد', 'إسلام عبد الله', 'رنا محمود', 'شريف منير', 'آية جمال',
  'طارق السيد', 'مي عبد الفتاح', 'حسام الدين علي', 'نهى فؤاد', 'وليد رشدي', 'سلمى أشرف',
  'عبد الله ناصر', 'إيمان شوقي', 'أحمد الدسوقي', 'ريهام عاطف', 'باسم الشناوي', 'نيرة حمدي',
  'مروان عصام', 'شيماء رضا', 'كريم عبد الحميد', 'هالة صبري', 'تامر الجندي', 'ندى البنا',
  'مجدي الصاوي', 'لبنى عبد الغني', 'هشام القاضي', 'جيهان فاضل', 'رامي المنشاوي', 'منى العشري',
  'عصام الدمرداش', 'سارة نبيل', 'أيمن الغرباوي', 'غادة المهدي',
];

export const PHONE_PREFIXES: ReadonlyArray<string> = ['010', '011', '012', '015'];

/** Health "profiles" the generator draws from, with their relative weight. */
export interface HealthProfile {
  weight: number;
  closed: readonly [number, number];
  open: readonly [number, number];
  priorities: ReadonlyArray<readonly [TicketPriority, number]>;
  /** Days ago an open ticket was opened. */
  openAge: readonly [number, number];
}

export const HEALTH_PROFILES: ReadonlyArray<HealthProfile> = [
  {
    weight: 55,
    closed: [0, 2],
    open: [0, 1],
    priorities: [['low', 6], ['medium', 3], ['high', 1]],
    openAge: [0, 4],
  },
  {
    weight: 28,
    closed: [1, 3],
    open: [1, 3],
    priorities: [['low', 2], ['medium', 4], ['high', 3], ['urgent', 1]],
    openAge: [2, 14],
  },
  {
    weight: 17,
    closed: [2, 4],
    open: [3, 5],
    priorities: [['medium', 2], ['high', 4], ['urgent', 3]],
    openAge: [6, 45],
  },
];
