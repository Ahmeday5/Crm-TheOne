import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';
import {
  ChatId,
  ChatMessage,
  ChatParticipant,
  Conversation,
  MessageType,
} from '../models/chat.model';

const STORAGE_KEY = 'crm_one_internal_chat_v1';

/** Accent palette shared by avatars across the feature. */
const AVATAR_COLORS = [
  '#0066cc', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#14b8a6',
];

/** Demo teammates the user can start chats / build groups with. */
const SEED_CONTACTS: Array<{ id: string; name: string }> = [
  { id: 'u-basma', name: 'بسمة عادل' },
  { id: 'u-omar', name: 'عمر خالد' },
  { id: 'u-sara', name: 'سارة منصور' },
  { id: 'u-mohamed', name: 'محمد فتحي' },
  { id: 'u-nour', name: 'نور إبراهيم' },
  { id: 'u-youssef', name: 'يوسف حسن' },
];

interface NewMediaInput {
  type: Exclude<MessageType, 'text'>;
  dataUrl: string;
  name?: string;
  mime?: string;
  size?: number;
  durationSec?: number;
  caption?: string;
}

/**
 * In-memory chat store backed by `localStorage`.
 *
 * State lives in signals so the standalone components react without manual
 * change detection. There's no server, so outgoing messages get simulated
 * delivery ticks and the peer fires a canned auto-reply — enough to feel live
 * during a demo while keeping the surface ready to swap for a real gateway.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  private seq = 0;

  readonly conversations = signal<Conversation[]>([]);
  readonly activeId = signal<ChatId | null>(null);

  /** The signed-in user, normalized to a chat participant. */
  readonly me = computed<ChatParticipant>(() => {
    const u = this.auth.currentUser();
    const name = u?.fullName?.trim() || u?.email || 'أنا';
    return { id: u?.userId ?? 'me', name, avatarColor: this.colorFor(name) };
  });

  readonly contacts = computed<ChatParticipant[]>(() =>
    SEED_CONTACTS.map((c) => ({ ...c, avatarColor: this.colorFor(c.name) })),
  );

  /** Conversations newest-activity first. */
  readonly orderedConversations = computed(() =>
    [...this.conversations()].sort((a, b) => b.updatedAt - a.updatedAt),
  );

  readonly activeConversation = computed<Conversation | null>(() => {
    const id = this.activeId();
    return id ? this.conversations().find((c) => c.id === id) ?? null : null;
  });

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + c.unread, 0),
  );

  constructor() {
    const stored = this.storage.getJson<Conversation[]>(STORAGE_KEY);
    if (stored && stored.length) {
      this.conversations.set(this.normalize(stored));
      this.seq = this.highestSeq(stored);
    } else {
      this.conversations.set(this.seedConversations());
      this.persist();
    }
  }

  // ─────────── selection ───────────

  select(id: ChatId): void {
    this.activeId.set(id);
    this.patch(id, (c) => ({ ...c, unread: 0 }));
  }

  clearSelection(): void {
    this.activeId.set(null);
  }

  // ─────────── sending ───────────

  sendText(text: string): void {
    const body = text.trim();
    const id = this.activeId();
    if (!body || !id) return;
    this.appendMine(id, { type: 'text', text: body });
    this.simulatePeer(id);
  }

  sendMedia(input: NewMediaInput): void {
    const id = this.activeId();
    if (!id) return;
    this.appendMine(id, {
      type: input.type,
      text: input.caption?.trim() || undefined,
      mediaUrl: input.dataUrl,
      mediaName: input.name,
      mediaMime: input.mime,
      fileSize: input.size,
      durationSec: input.durationSec,
    });
    this.simulatePeer(id);
  }

  // ─────────── conversation creation ───────────

  /** Open (or create) a 1:1 chat with a contact and select it. */
  startDirect(contactId: string): void {
    const existing = this.conversations().find(
      (c) => c.kind === 'direct' && c.participants[0]?.id === contactId,
    );
    if (existing) {
      this.select(existing.id);
      return;
    }
    const contact = this.contacts().find((c) => c.id === contactId);
    if (!contact) return;

    const convo: Conversation = {
      id: this.nextId('c'),
      kind: 'direct',
      name: contact.name,
      participants: [contact],
      avatarColor: contact.avatarColor,
      messages: [],
      unread: 0,
      typing: false,
      online: true,
      updatedAt: Date.now(),
    };
    this.conversations.update((list) => [convo, ...list]);
    this.persist();
    this.select(convo.id);
  }

  createGroup(name: string, memberIds: string[]): void {
    const members = this.contacts().filter((c) => memberIds.includes(c.id));
    if (members.length < 2) return;
    const clean = name.trim() || members.map((m) => m.name).join('، ');

    const convo: Conversation = {
      id: this.nextId('g'),
      kind: 'group',
      name: clean,
      participants: members,
      avatarColor: this.colorFor(clean),
      messages: [],
      unread: 0,
      typing: false,
      online: false,
      updatedAt: Date.now(),
    };
    this.conversations.update((list) => [convo, ...list]);
    this.persist();
    this.select(convo.id);
  }

  // ─────────── internals ───────────

  private appendMine(
    id: ChatId,
    partial: Partial<ChatMessage> & { type: MessageType },
  ): void {
    const me = this.me();
    const msg: ChatMessage = {
      id: this.nextId('m'),
      conversationId: id,
      senderId: me.id,
      senderName: me.name,
      type: partial.type,
      text: partial.text,
      mediaUrl: partial.mediaUrl,
      mediaName: partial.mediaName,
      mediaMime: partial.mediaMime,
      durationSec: partial.durationSec,
      fileSize: partial.fileSize,
      createdAt: Date.now(),
      status: 'sent',
      mine: true,
    };
    this.patch(id, (c) => ({
      ...c,
      messages: [...c.messages, msg],
      updatedAt: msg.createdAt,
    }));
    this.persist();
    // Tick progression: sent → delivered → read.
    this.advanceStatus(id, msg.id, 'delivered', 800);
    this.advanceStatus(id, msg.id, 'read', 2200);
  }

  /** Canned peer reply so send/receive feels alive without a server. */
  private simulatePeer(id: ChatId): void {
    const convo = this.conversations().find((c) => c.id === id);
    if (!convo) return;
    const replier =
      convo.kind === 'direct'
        ? convo.participants[0]
        : convo.participants[Math.floor(this.pseudoRandom() * convo.participants.length)];
    if (!replier) return;

    this.patch(id, (c) => ({ ...c, typing: true }));

    const replies = [
      'تمام 👍',
      'حاضر، هتظبط',
      'وصلتني الرسالة، شكرًا',
      'ماشي نتكلم في ده',
      'جاري المراجعة وأرد عليك حالًا',
      'تمام كده ممتاز 🙌',
    ];
    const text = replies[Math.floor(this.pseudoRandom() * replies.length)];

    window.setTimeout(() => {
      const incoming: ChatMessage = {
        id: this.nextId('m'),
        conversationId: id,
        senderId: replier.id,
        senderName: replier.name,
        type: 'text',
        text,
        createdAt: Date.now(),
        status: 'read',
        mine: false,
      };
      const isActive = this.activeId() === id;
      this.patch(id, (c) => ({
        ...c,
        typing: false,
        messages: [...c.messages, incoming],
        unread: isActive ? 0 : c.unread + 1,
        updatedAt: incoming.createdAt,
      }));
      this.persist();
    }, 1500);
  }

  private advanceStatus(
    id: ChatId,
    msgId: string,
    status: ChatMessage['status'],
    delay: number,
  ): void {
    window.setTimeout(() => {
      this.patch(id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === msgId ? { ...m, status } : m,
        ),
      }));
      this.persist();
    }, delay);
  }

  private patch(id: ChatId, fn: (c: Conversation) => Conversation): void {
    this.conversations.update((list) =>
      list.map((c) => (c.id === id ? fn(c) : c)),
    );
  }

  private persist(): void {
    this.storage.setJson(STORAGE_KEY, this.conversations());
  }

  // ─────────── helpers ───────────

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.seq}`;
  }

  /** Deterministic-ish jitter without `Math.random` reproducibility concerns. */
  private pseudoRandom(): number {
    return Math.random();
  }

  colorFor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '؟';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return (parts[0][0] ?? '') + (parts[1][0] ?? '');
  }

  private normalize(list: Conversation[]): Conversation[] {
    return list.map((c) => ({
      ...c,
      typing: false,
      messages: c.messages ?? [],
      participants: c.participants ?? [],
    }));
  }

  private highestSeq(list: Conversation[]): number {
    let max = 0;
    for (const c of list) {
      for (const m of c.messages ?? []) {
        const n = Number(m.id.split('-').pop());
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return max;
  }

  // ─────────── seed ───────────

  private seedConversations(): Conversation[] {
    const now = Date.now();
    const min = 60_000;
    const mk = (
      id: string,
      kind: 'direct' | 'group',
      name: string,
      members: Array<{ id: string; name: string }>,
      messages: Array<Partial<ChatMessage> & { mine: boolean; ago: number }>,
      unread = 0,
    ): Conversation => {
      const parts = members.map((m) => ({
        ...m,
        avatarColor: this.colorFor(m.name),
      }));
      const msgs: ChatMessage[] = messages.map((m) => {
        this.seq += 1;
        return {
          id: `m-seed-${this.seq}`,
          conversationId: id,
          senderId: m.mine ? 'me' : parts[0]?.id ?? 'peer',
          senderName: m.mine ? 'أنا' : parts[0]?.name ?? '',
          type: 'text',
          text: m.text,
          createdAt: now - m.ago * min,
          status: 'read',
          mine: m.mine,
        };
      });
      return {
        id,
        kind,
        name,
        participants: parts,
        avatarColor: kind === 'group' ? this.colorFor(name) : parts[0].avatarColor,
        messages: msgs,
        unread,
        typing: false,
        online: kind === 'direct',
        updatedAt: msgs.length ? msgs[msgs.length - 1].createdAt : now,
      };
    };

    return [
      mk(
        'c-seed-1',
        'direct',
        'بسمة عادل',
        [{ id: 'u-basma', name: 'بسمة عادل' }],
        [
          { mine: false, text: 'صباح الخير، جاهزة لمراجعة الحملة الجديدة؟', ago: 180 },
          { mine: true, text: 'صباح النور، أيوة جاهز. ابعتيلي اللينك', ago: 176 },
          { mine: false, text: 'تمام، هبعته حالًا 👌', ago: 174 },
        ],
        1,
      ),
      mk(
        'g-seed-1',
        'group',
        'فريق التسويق',
        [
          { id: 'u-omar', name: 'عمر خالد' },
          { id: 'u-sara', name: 'سارة منصور' },
          { id: 'u-nour', name: 'نور إبراهيم' },
        ],
        [
          { mine: false, text: 'يا جماعة، تقرير الأداء اتحدّث', ago: 60 },
          { mine: true, text: 'تمام، هبصّ عليه دلوقتي', ago: 58 },
        ],
        2,
      ),
      mk(
        'c-seed-2',
        'direct',
        'محمد فتحي',
        [{ id: 'u-mohamed', name: 'محمد فتحي' }],
        [
          { mine: true, text: 'العقد اتبعت للعميل', ago: 1440 },
          { mine: false, text: 'جامد، شكرًا 🙏', ago: 1438 },
        ],
      ),
    ];
  }
}
