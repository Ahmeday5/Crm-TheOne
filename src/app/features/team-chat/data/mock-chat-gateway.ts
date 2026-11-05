import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  ChatMessage,
  ChatUser,
  Conversation,
  MessageStatus,
  TypingState,
} from '../models/team-chat.models';
import { ChatGateway } from './chat-gateway';
import { MOCK_CANNED_REPLIES, buildMockSeed } from './mock-chat.seed';

const SENT_MS = 350;
const DELIVERED_MS = 900;
const REPLY_TYPING_MS = 1_400;
const REPLY_MS = 3_200;

/**
 * TEMPORARY in-memory adapter — design/preview only, nothing leaves the
 * browser. Simulates what the Firebase adapter will do: message status
 * ticks (sent → delivered → read), colleagues typing and replying, unread
 * counters, pin/mute.
 *
 * Provided per page (see `provideChatGateway()`), so each visit starts from
 * a fresh seed for whoever is signed in.
 */
@Injectable()
export class MockChatGateway extends ChatGateway implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private readonly meUser: ChatUser;
  private readonly users = new BehaviorSubject<ChatUser[]>([]);
  private readonly conversations = new BehaviorSubject<Conversation[]>([]);
  private readonly messages = new BehaviorSubject<ReadonlyMap<string, ChatMessage[]>>(new Map());
  private readonly typing = new BehaviorSubject<TypingState[]>([]);
  private replyCursor = 0;

  constructor() {
    super();
    const user = this.auth.currentUser();
    this.meUser = {
      id: user?.userId || 'me',
      name: user?.fullName || user?.email?.split('@')[0] || 'Me',
      role: user?.role ?? 'Admin',
      imageUrl: user?.imageUrl ?? null,
      presence: 'online',
    };
    const seed = buildMockSeed(this.meUser);
    this.users.next(seed.users);
    this.conversations.next(seed.conversations);
    this.messages.next(seed.messages);
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  me(): ChatUser {
    return this.meUser;
  }

  users$(): Observable<ChatUser[]> {
    return this.users.asObservable();
  }

  conversations$(): Observable<Conversation[]> {
    return this.conversations.pipe(
      map((list) =>
        [...list].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? '');
        }),
      ),
    );
  }

  messages$(conversationId: string): Observable<ChatMessage[]> {
    return this.messages.pipe(
      map((all) => all.get(conversationId) ?? []),
      distinctUntilChanged(),
    );
  }

  typing$(): Observable<TypingState[]> {
    return this.typing.asObservable();
  }

  send(conversationId: string, text: string): Observable<ChatMessage> {
    const message: ChatMessage = {
      id: this.id(),
      conversationId,
      senderId: this.meUser.id,
      text: text.trim(),
      sentAt: new Date().toISOString(),
      status: 'sending',
    };
    this.appendMessage(message);
    this.later(SENT_MS, () => this.setStatus(message, 'sent'));
    this.later(DELIVERED_MS, () => this.setStatus(message, 'delivered'));
    this.simulateReply(conversationId, message);
    return of(message);
  }

  markRead(conversationId: string): void {
    this.patchConversation(conversationId, { unreadCount: 0 });
  }

  setTyping(): void {
    /* Nobody listens to the mock user's typing. */
  }

  openDirect(userId: string): Observable<Conversation> {
    const existing = this.conversations.value.find(
      (c) => c.kind === 'direct' && c.memberIds.includes(userId),
    );
    if (existing) return of(existing);
    const other = this.users.value.find((u) => u.id === userId);
    const created: Conversation = {
      id: this.id(),
      kind: 'direct',
      title: other?.name ?? '',
      memberIds: [this.meUser.id, userId],
      lastMessage: null,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
    };
    this.conversations.next([created, ...this.conversations.value]);
    return of(created);
  }

  setPinned(conversationId: string, pinned: boolean): void {
    this.patchConversation(conversationId, { isPinned: pinned });
  }

  setMuted(conversationId: string, muted: boolean): void {
    this.patchConversation(conversationId, { isMuted: muted });
  }

  // ─────────── simulation ───────────

  private simulateReply(conversationId: string, mine: ChatMessage): void {
    const conv = this.conversations.value.find((c) => c.id === conversationId);
    if (!conv) return;
    const candidates = this.users.value.filter(
      (u) => u.id !== this.meUser.id && u.presence !== 'offline' && conv.memberIds.includes(u.id),
    );
    if (candidates.length === 0) return;
    const responder = candidates[this.replyCursor % candidates.length];

    this.later(REPLY_TYPING_MS, () => this.setUserTyping(conversationId, responder.id, true));
    this.later(REPLY_MS, () => {
      this.setUserTyping(conversationId, responder.id, false);
      this.setStatus(mine, 'read');
      const reply: ChatMessage = {
        id: this.id(),
        conversationId,
        senderId: responder.id,
        text: MOCK_CANNED_REPLIES[this.replyCursor++ % MOCK_CANNED_REPLIES.length],
        sentAt: new Date().toISOString(),
        status: 'read',
      };
      this.appendMessage(reply, true);
    });
  }

  private setUserTyping(conversationId: string, userId: string, on: boolean): void {
    const others = this.typing.value.filter((t) => t.conversationId !== conversationId);
    const current = this.typing.value.find((t) => t.conversationId === conversationId)?.userIds ?? [];
    const ids = on ? [...new Set([...current, userId])] : current.filter((id) => id !== userId);
    this.typing.next(ids.length ? [...others, { conversationId, userIds: ids }] : others);
  }

  // ─────────── state helpers ───────────

  private appendMessage(message: ChatMessage, incoming = false): void {
    const next = new Map(this.messages.value);
    next.set(message.conversationId, [...(next.get(message.conversationId) ?? []), message]);
    this.messages.next(next);
    const conv = this.conversations.value.find((c) => c.id === message.conversationId);
    this.patchConversation(message.conversationId, {
      lastMessage: message,
      unreadCount: incoming ? (conv?.unreadCount ?? 0) + 1 : conv?.unreadCount ?? 0,
    });
  }

  private setStatus(message: ChatMessage, status: MessageStatus): void {
    const list = this.messages.value.get(message.conversationId);
    if (!list) return;
    const next = new Map(this.messages.value);
    const updated = list.map((m) => (m.id === message.id ? { ...m, status } : m));
    next.set(message.conversationId, updated);
    this.messages.next(next);
    const conv = this.conversations.value.find((c) => c.id === message.conversationId);
    if (conv?.lastMessage?.id === message.id) {
      this.patchConversation(conv.id, { lastMessage: { ...conv.lastMessage, status } });
    }
  }

  private patchConversation(id: string, changes: Partial<Conversation>): void {
    this.conversations.next(
      this.conversations.value.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    );
  }

  private later(ms: number, fn: () => void): void {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      fn();
    }, ms);
    this.timers.add(handle);
  }

  private id(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
