import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { ChatGateway } from '../data/chat-gateway';
import { ChatMessage, ChatUser, Conversation } from '../models/team-chat.models';

export type ConversationFilter = 'all' | 'direct' | 'channel' | 'unread';

/** One rendered message with its grouping hints. */
export interface MessageRow {
  message: ChatMessage;
  sender: ChatUser | undefined;
  mine: boolean;
  /** First message of a run by the same sender (shows name/avatar). */
  runStart: boolean;
  /** Last message of a run (shows the bubble tail + time). */
  runEnd: boolean;
}

export interface DayGroup {
  /** `YYYY-MM-DD` (local) — used as the track key and for the label. */
  day: string;
  rows: MessageRow[];
}

/** Same sender within this window → one visual run. */
const RUN_GAP_MS = 5 * 60_000;

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Page-scoped state for the team chat. Talks only to `ChatGateway`, so the
 * mock → Firebase swap never touches this file.
 */
@Injectable()
export class TeamChatStore {
  private readonly gateway = inject(ChatGateway);

  readonly me = this.gateway.me();
  readonly users = toSignal(this.gateway.users$(), { initialValue: [] as ChatUser[] });
  readonly conversations = toSignal(this.gateway.conversations$(), { initialValue: [] as Conversation[] });
  private readonly typing = toSignal(this.gateway.typing$(), { initialValue: [] });

  // ─────────── UI state ───────────
  readonly filter = signal<ConversationFilter>('all');
  readonly search = signal('');
  readonly activeId = signal<string | null>(null);

  readonly usersById = computed(() => new Map(this.users().map((u) => [u.id, u])));

  readonly colleagues = computed(() =>
    this.users()
      .filter((u) => u.id !== this.me.id)
      .sort((a, b) => presenceRank(a) - presenceRank(b) || a.name.localeCompare(b.name)),
  );

  readonly onlineCount = computed(() => this.colleagues().filter((u) => u.presence === 'online').length);

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.isMuted ? 0 : c.unreadCount), 0),
  );

  readonly visibleConversations = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.conversations().filter((c) => {
      if (f === 'direct' && c.kind !== 'direct') return false;
      if (f === 'channel' && c.kind !== 'channel') return false;
      if (f === 'unread' && c.unreadCount === 0) return false;
      return !q || c.title.toLowerCase().includes(q) || (c.lastMessage?.text ?? '').toLowerCase().includes(q);
    });
  });

  readonly active = computed(() => this.conversations().find((c) => c.id === this.activeId()) ?? null);

  /** The other participant of the active direct chat. */
  readonly peer = computed(() => {
    const c = this.active();
    if (!c || c.kind !== 'direct') return null;
    const id = c.memberIds.find((m) => m !== this.me.id);
    return id ? this.usersById().get(id) ?? null : null;
  });

  readonly activeMembers = computed(() => {
    const c = this.active();
    if (!c) return [];
    const byId = this.usersById();
    return c.memberIds.map((id) => byId.get(id)).filter((u): u is ChatUser => !!u);
  });

  private readonly activeMessages = toSignal(
    toObservable(this.activeId).pipe(
      switchMap((id): Observable<ChatMessage[]> => (id ? this.gateway.messages$(id) : of([]))),
    ),
    { initialValue: [] as ChatMessage[] },
  );

  /** Messages grouped by day, then into runs by sender. */
  readonly dayGroups = computed<DayGroup[]>(() => {
    const byId = this.usersById();
    const groups: DayGroup[] = [];
    let prev: ChatMessage | null = null;
    const list = this.activeMessages();

    list.forEach((m, i) => {
      const day = localDay(m.sentAt);
      let group = groups[groups.length - 1];
      if (!group || group.day !== day) {
        group = { day, rows: [] };
        groups.push(group);
        prev = null;
      }
      const next = list[i + 1];
      const sameRun = (a: ChatMessage | null | undefined, b: ChatMessage | null | undefined) =>
        !!a && !!b && a.senderId === b.senderId && localDay(a.sentAt) === localDay(b.sentAt) &&
        Math.abs(Date.parse(b.sentAt) - Date.parse(a.sentAt)) < RUN_GAP_MS;

      group.rows.push({
        message: m,
        sender: byId.get(m.senderId),
        mine: m.senderId === this.me.id,
        runStart: !sameRun(prev, m),
        runEnd: !sameRun(m, next),
      });
      prev = m;
    });
    return groups;
  });

  readonly messageCount = computed(() => this.activeMessages().length);

  /** Names of people typing in the active conversation. */
  readonly typingNames = computed(() => {
    const id = this.activeId();
    const state = this.typing().find((t) => t.conversationId === id);
    if (!state) return [];
    const byId = this.usersById();
    return state.userIds.map((u) => byId.get(u)?.name ?? '').filter(Boolean);
  });

  /** Conversation ids where someone is typing (list preview). */
  readonly typingIn = computed(() => new Set(this.typing().map((t) => t.conversationId)));

  // ─────────── commands ───────────

  open(id: string | null): void {
    this.activeId.set(id);
    if (id) this.gateway.markRead(id);
  }

  /** Called when new messages land while the conversation is on screen. */
  markActiveRead(): void {
    const c = this.active();
    if (c?.unreadCount) this.gateway.markRead(c.id);
  }

  send(text: string): void {
    const id = this.activeId();
    if (!id || !text.trim()) return;
    this.gateway.send(id, text).subscribe();
  }

  setTyping(typing: boolean): void {
    const id = this.activeId();
    if (id) this.gateway.setTyping(id, typing);
  }

  openDirect(userId: string): Observable<Conversation> {
    return this.gateway.openDirect(userId);
  }

  togglePin(c: Conversation): void {
    this.gateway.setPinned(c.id, !c.isPinned);
  }

  toggleMute(c: Conversation): void {
    this.gateway.setMuted(c.id, !c.isMuted);
  }

  /** Display name for a conversation (direct chats show the peer). */
  peerOf(c: Conversation): ChatUser | null {
    if (c.kind !== 'direct') return null;
    const id = c.memberIds.find((m) => m !== this.me.id);
    return id ? this.usersById().get(id) ?? null : null;
  }
}

function presenceRank(u: ChatUser): number {
  return u.presence === 'online' ? 0 : u.presence === 'away' ? 1 : 2;
}
