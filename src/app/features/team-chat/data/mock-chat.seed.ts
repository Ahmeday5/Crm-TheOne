import { ChatMessage, ChatUser, Conversation } from '../models/team-chat.models';

/**
 * Demo data for the chat preview. Purely illustrative — replaced by the
 * Firebase adapter, which reads real employees and conversations.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const MOCK_CANNED_REPLIES: ReadonlyArray<string> = [
  'تمام، هشوفها حالًا 👍',
  'تمام، تم 🙌',
  'ممكن تبعتلي التفاصيل؟',
  'حاضر، هرجعلك خلال ساعة.',
  'ممتاز، شكرًا!',
  'أكيد، خلّينا نتكلم بعد الاجتماع.',
];

interface MockSeed {
  users: ChatUser[];
  conversations: Conversation[];
  messages: ReadonlyMap<string, ChatMessage[]>;
}

export function buildMockSeed(me: ChatUser): MockSeed {
  const now = Date.now();
  const at = (agoMs: number) => new Date(now - agoMs).toISOString();

  const colleagues: ChatUser[] = [
    { id: 'u-sara', name: 'سارة محمود', role: 'Sales', presence: 'online' },
    { id: 'u-omar', name: 'عمر خالد', role: 'Developer', presence: 'online' },
    { id: 'u-mona', name: 'منى السيد', role: 'Marketing', presence: 'away' },
    { id: 'u-youssef', name: 'يوسف علي', role: 'Support', presence: 'online' },
    { id: 'u-nour', name: 'نور حسن', role: 'Sales', presence: 'offline', lastSeenAt: at(2 * HOUR) },
    { id: 'u-karim', name: 'كريم عادل', role: 'Admin', presence: 'offline', lastSeenAt: at(DAY) },
  ];
  const users = [me, ...colleagues];
  const everyone = users.map((u) => u.id);

  let seq = 0;
  const msg = (conversationId: string, senderId: string, text: string, agoMs: number): ChatMessage => ({
    id: `seed-${++seq}`,
    conversationId,
    senderId,
    text,
    sentAt: at(agoMs),
    status: 'read',
  });

  const thread: Record<string, ChatMessage[]> = {
    'c-general': [
      msg('c-general', 'u-karim', 'صباح الخير يا فريق ☀️ اجتماع الأسبوع يوم الأحد الساعة 11.', DAY + 3 * HOUR),
      msg('c-general', 'u-mona', 'تمام، هجهز تقرير الحملات.', DAY + 2 * HOUR),
      msg('c-general', 'u-omar', 'نسخة السيستم الجديدة نزلت على السيرفر 🚀', 3 * HOUR),
      msg('c-general', 'u-youssef', 'ممتاز، هبلغ العملاء بالتحديثات.', 2 * HOUR + 40 * MIN),
    ],
    'c-sales': [
      msg('c-sales', 'u-sara', 'العميل بتاع شركة الأمل محتاج عرض سعر النهارده.', 5 * HOUR),
      msg('c-sales', me.id, 'تمام، هبعته قبل الساعة 3.', 4 * HOUR + 50 * MIN),
      msg('c-sales', 'u-nour', 'في 3 عملاء جداد من حملة الفيسبوك محتاجين متابعة.', 2 * HOUR + 10 * MIN),
    ],
    'c-support': [
      msg('c-support', 'u-youssef', 'في تذكرة عاجلة من عميل ذا ون المحاسبي — مشكلة في الطباعة.', 50 * MIN),
    ],
    'c-dev': [
      msg('c-dev', 'u-omar', 'محتاجين نراجع الـ API بتاع الإعلانات قبل الربط.', DAY + 6 * HOUR),
    ],
    'd-sara': [
      msg('d-sara', 'u-sara', 'ممكن تراجع معايا عرض السعر قبل ما أبعته؟', 40 * MIN),
      msg('d-sara', me.id, 'أكيد، ابعتيه هنا.', 35 * MIN),
      msg('d-sara', 'u-sara', 'تمام، خمس دقايق وهيكون عندك 🙏', 12 * MIN),
    ],
    'd-omar': [
      msg('d-omar', me.id, 'هل تقدر تزود فلتر بالمندوب في صفحة الـ Kanban؟', 3 * HOUR),
      msg('d-omar', 'u-omar', 'اتعمل وهو live دلوقتي ✅', 2 * HOUR + 30 * MIN),
    ],
    'd-mona': [msg('d-mona', 'u-mona', 'شوفت نتايج حملة الأسبوع اللي فات؟', DAY + 1 * HOUR)],
  };

  const conv = (
    c: Omit<Conversation, 'lastMessage' | 'unreadCount' | 'isPinned' | 'isMuted'>,
    extra: Partial<Conversation> = {},
  ): Conversation => {
    const list = thread[c.id] ?? [];
    return {
      ...c,
      lastMessage: list[list.length - 1] ?? null,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      ...extra,
    };
  };

  const conversations: Conversation[] = [
    conv(
      { id: 'c-general', kind: 'channel', title: 'عام', icon: 'fa-solid fa-hashtag', topic: 'لكل موظفي الشركة', memberIds: everyone },
      { isPinned: true, unreadCount: 2 },
    ),
    conv(
      { id: 'c-sales', kind: 'channel', title: 'فريق المبيعات', icon: 'fa-solid fa-sack-dollar', topic: 'متابعة العملاء والعروض', memberIds: [me.id, 'u-sara', 'u-nour', 'u-karim'] },
      { unreadCount: 1 },
    ),
    conv(
      { id: 'c-support', kind: 'channel', title: 'الدعم الفني', icon: 'fa-solid fa-headset', topic: 'التذاكر العاجلة', memberIds: [me.id, 'u-youssef', 'u-omar'] },
      { unreadCount: 1 },
    ),
    conv(
      { id: 'c-dev', kind: 'channel', title: 'التطوير', icon: 'fa-solid fa-code', topic: 'المشاريع والإصدارات', memberIds: [me.id, 'u-omar', 'u-karim'] },
      { isMuted: true },
    ),
    conv({ id: 'd-sara', kind: 'direct', title: 'سارة محمود', memberIds: [me.id, 'u-sara'] }, { unreadCount: 1, isPinned: true }),
    conv({ id: 'd-omar', kind: 'direct', title: 'عمر خالد', memberIds: [me.id, 'u-omar'] }),
    conv({ id: 'd-mona', kind: 'direct', title: 'منى السيد', memberIds: [me.id, 'u-mona'] }),
  ];

  return { users, conversations, messages: new Map(Object.entries(thread)) };
}
