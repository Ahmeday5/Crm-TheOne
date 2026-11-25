import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  interval,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { INBOX_TOOLS_GATEWAY } from '../data/inbox-tools.gateway';
import { Pagination, WaChat, WaChatCounters, WaChatLabel, WaChatsQuery } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { pollWhileVisible } from '../../../core/utils/poll-while-visible.util';
import {
  WHATSAPP_CHATS_PAGE_SIZE,
  WHATSAPP_FALLBACK_POLL_MS,
  WHATSAPP_SEARCH_DEBOUNCE_MS,
  compareChatsByActivity,
  whatsappErrorText,
} from '../utils/whatsapp.util';
import {
  DEFAULT_AWAITING_THRESHOLD_MIN,
  INBOX_TOOLS_CLOCK_MS,
  compareByIso,
  isAwaitingReply,
  isReminderDue,
} from '../utils/inbox-tools.util';
import { WhatsAppSessionStore } from './whatsapp-session.store';

/** The API caps `pageSize` here — a background refresh re-reads at most this many rows. */
const MAX_PAGE_SIZE = 100;

/**
 * - `awaiting` — «مستني رد»: waiting for our reply longer than the threshold, oldest first;
 * - `followups` — «متابعات»: chats with a pending / due reminder, earliest first.
 */
export type ChatsFilter = 'all' | 'unread' | 'awaiting' | 'followups';

/** Re-read the red badges this often while the tab is visible (real API only). */
const COUNTERS_POLL_MS = 60_000;

interface ListQuery {
  /** Admin channel filter — `null` = all channels (employees are scoped server-side). */
  channelId: string | null;
  search: string;
  filter: ChatsFilter;
  /** One label chip (combines with the filter) — `null` = any. */
  label: WaChatLabel | null;
}

/**
 * The inbox's chat list. Provided by the inbox page.
 *
 * - The query (channel · search · All/Unread) drives a `switchMap`, so a
 *   stale page never lands under a newer query.
 * - Infinite scroll appends 30 at a time, de-duplicated by id.
 * - Hub events upsert chats live: a new message moves its chat to the top
 *   (only when it belongs to the viewed channel); a `chatUpdated` patches it.
 * - After a reconnect — or every 20 s while the hub is down — the visible
 *   window is re-read so nothing missed stays missing.
 */
@Injectable()
export class WhatsAppInboxStore {
  private readonly api = inject(WhatsAppApiService);
  private readonly realtime = inject(WhatsAppRealtimeService);
  private readonly session = inject(WhatsAppSessionStore);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  /** Inbox v4 tools — labels, notes, reminders, counters, transfer. */
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);

  private readonly query = signal<ListQuery>({ channelId: null, search: '', filter: 'all', label: null });
  private readonly items = signal<WaChat[]>([]);
  private readonly total = signal(0);
  /** Every chat seen this visit — the open chat keeps its header when filtered out. */
  private readonly seen = signal<ReadonlyMap<number, WaChat>>(new Map());
  private readonly deletedSubject = new Subject<number>();
  /** A chat left the inbox (deleted here or by someone else) — the page closes it if open. */
  readonly chatDeleted$ = this.deletedSubject.asObservable();

  readonly channelId = computed(() => this.query().channelId);
  readonly search = computed(() => this.query().search);
  readonly filter = computed(() => this.query().filter);
  readonly label = computed(() => this.query().label);
  readonly activeChatId = signal<number | null>(null);

  /** A coarse clock for "waiting since …" (re-evaluated every minute). */
  readonly now = signal(Date.now());
  private readonly serverCounters = signal<WaChatCounters | null>(null);
  private readonly countersRefresh$ = new Subject<void>();

  /** Minutes without a reply before a chat counts as «مستني رد» — the server's number when known. */
  readonly thresholdMinutes = computed(() => this.serverCounters()?.thresholdMinutes ?? DEFAULT_AWAITING_THRESHOLD_MIN);

  /** The two red badges — `GET chats/counters` (scope = the chats the caller can see). */
  readonly counters = computed<WaChatCounters>(
    () => this.serverCounters() ?? { awaitingReply: 0, overdueReminders: 0, thresholdMinutes: DEFAULT_AWAITING_THRESHOLD_MIN },
  );

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * The open chat always shows as read — the thread marks it read itself.
   * Deleted chats are excluded server-side (list, counts, search); a live
   * deletion is removed in `removeChat`. Nothing is filtered or counted here.
   */
  readonly chats = computed<WaChat[]>(() => {
    const active = this.activeChatId();
    const list = this.items().map((c) => (c.id === active && c.unreadCount ? { ...c, unreadCount: 0 } : c));
    return this.applyToolFilters(list);
  });
  readonly hasMore = computed(() => this.items().length < this.total());
  /** The open chat as the server reports it (real unread count — the thread decides on marking read). */
  readonly activeChat = computed(() => {
    const id = this.activeChatId();
    return id ? this.items().find((c) => c.id === id) ?? this.seen().get(id) ?? null : null;
  });

  private readonly searchInput = new Subject<string>();
  private readonly reload$ = new Subject<void>();
  /** Bumped per query — appended / refreshed pages for an older query are dropped. */
  private version = 0;
  private started = false;

  /** Wire the list to its query and to the hub. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.searchInput
      .pipe(
        map((term) => term.trim()),
        debounceTime(WHATSAPP_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((search) => this.patchQuery({ search }));

    // First page of the current query — switchMap cancels the previous one.
    merge(toObservable(this.query, { injector: this.injector }).pipe(map(() => undefined)), this.reload$)
      .pipe(
        tap(() => this.beginFirstPage()),
        switchMap(() => {
          const version = this.version;
          return this.read(1, WHATSAPP_CHATS_PAGE_SIZE).pipe(map((page) => ({ page, version })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, version }) => {
        if (version !== this.version) return;
        this.loading.set(false);
        if (!page) return;
        this.setItems(page.data);
        this.total.set(page.count);
      });

    // The event's `instanceId` is the channel the message belongs to — the
    // filter key for "only the selected channel's chats".
    this.realtime.message$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ instanceId, chat }) => this.upsert({ ...chat, instanceId: instanceId || chat.instanceId }, true));
    this.realtime.chatUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((chat) => {
        if (chat.isDeleted) {
          this.removeChat(chat.id);
          // Channel badges / "all channels" come from the server — re-read them.
          this.session.loadChannels();
        } else {
          this.upsert(chat, false);
        }
      });

    // Catch up after a gap; keep fresh by polling only while the hub is down.
    merge(
      this.realtime.reconnected$,
      toObservable(this.realtime.state, { injector: this.injector }).pipe(
        switchMap((state) => (state === 'reconnecting' ? pollWhileVisible(WHATSAPP_FALLBACK_POLL_MS) : EMPTY)),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());

    this.startTools();
  }

  /** Inbox v4: the clock behind "waiting since…" / "reminder due", and the red badges. */
  private startTools(): void {

    interval(INBOX_TOOLS_CLOCK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));

    merge(
      this.countersRefresh$,
      toObservable(this.channelId, { injector: this.injector }).pipe(map(() => undefined)),
      merge(this.realtime.message$, this.realtime.chatUpdated$, this.realtime.reconnected$).pipe(debounceTime(1500)),
      pollWhileVisible(COUNTERS_POLL_MS),
    )
      .pipe(
        switchMap(() =>
          this.tools
            .counters(this.session.isAdmin() ? this.channelId() : null)
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((c) => {
        if (c) this.serverCounters.set(c);
      });
  }

  /** Re-read the red badges now (after a label, a reminder…). */
  refreshCounters(): void {
    this.countersRefresh$.next();
  }

  // ─────────────── query ───────────────

  setSearch(term: string): void {
    this.searchInput.next(term);
  }

  setFilter(filter: ChatsFilter): void {
    this.patchQuery({ filter });
  }

  /** Toggle a label chip — `null` clears it. */
  setLabel(label: WaChatLabel | null): void {
    this.patchQuery({ label });
  }

  /** Admin: `null` = all channels. */
  setChannel(channelId: string | null): void {
    this.patchQuery({ channelId });
  }

  setActive(chatId: number | null): void {
    this.activeChatId.set(chatId);
  }

  /** Fresh first page (retry button). */
  reload(): void {
    this.reload$.next();
  }

  // ─────────────── paging ───────────────

  loadMore(): void {
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    const version = this.version;
    const next = Math.floor(this.items().length / WHATSAPP_CHATS_PAGE_SIZE) + 1;
    this.loadingMore.set(true);
    this.read(next, WHATSAPP_CHATS_PAGE_SIZE).subscribe((page) => {
      if (version !== this.version) return;
      this.loadingMore.set(false);
      if (!page) return;
      // New activity shifts rows between pages — never show a chat twice.
      const have = new Set(this.items().map((c) => c.id));
      this.setItems([...this.items(), ...this.preferLive(page.data).filter((c) => !have.has(c.id))]);
      this.total.set(page.count);
    });
  }

  /** Re-read the window already on screen, keeping the user's scroll depth. */
  refresh(): void {
    if (this.refreshing() || this.loading()) return;
    const version = this.version;
    const size = Math.min(MAX_PAGE_SIZE, Math.max(WHATSAPP_CHATS_PAGE_SIZE, this.items().length));
    this.refreshing.set(true);
    this.read(1, size).subscribe((page) => {
      this.refreshing.set(false);
      if (version !== this.version || !page) return;
      const fresh = new Set(page.data.map((c) => c.id));
      const tail = this.items().slice(page.data.length).filter((c) => !fresh.has(c.id));
      this.setItems([...this.preferLive(page.data), ...tail].sort(compareChatsByActivity));
      this.total.set(page.count);
      this.error.set(null);
    });
  }

  // ─────────────── local updates ───────────────

  /**
   * Drop a chat from the list (deleted — by us optimistically, or announced by
   * the hub). Returns the removed row so a failed delete can put it back.
   */
  removeChat(chatId: number): WaChat | null {
    const removed = this.items().find((c) => c.id === chatId) ?? this.seen().get(chatId) ?? null;
    if (this.items().some((c) => c.id === chatId)) {
      this.items.update((list) => list.filter((c) => c.id !== chatId));
      this.total.update((n) => Math.max(0, n - 1));
    }
    this.seen.update((map) => {
      if (!map.has(chatId)) return map;
      const next = new Map(map);
      next.delete(chatId);
      return next;
    });
    this.deletedSubject.next(chatId);
    return removed;
  }

  /** Undo an optimistic removal (the delete failed). */
  restoreChat(chat: WaChat): void {
    if (this.items().some((c) => c.id === chat.id)) return;
    this.items.update((list) => [...list, chat].sort(compareChatsByActivity));
    this.total.update((n) => n + 1);
  }

  /** A chat changed locally (e.g. linked to a customer) — patch it in place. */
  patchChat(chat: WaChat): void {
    this.upsert(chat, false);
  }

  /** The thread just marked this chat read. */
  markReadLocally(chatId: number): void {
    this.items.update((list) => list.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
  }

  chat(chatId: number): WaChat | null {
    return this.items().find((c) => c.id === chatId) ?? this.seen().get(chatId) ?? null;
  }

  // ─────────────── internals ───────────────

  /**
   * Live upsert. A chat outside the current view is only remembered: other
   * channels never leak into a filtered list, and server-side search can't
   * be evaluated here, so a search view only updates rows it already shows.
   */
  private upsert(chat: WaChat, bumped: boolean): void {
    this.remember([chat]);
    const { channelId, search, filter } = this.query();
    const list = this.items();
    const index = list.findIndex((c) => c.id === chat.id);

    if (index < 0) {
      const belongs = (!channelId || chat.instanceId === channelId) && !search;
      const matchesFilter =
        filter === 'unread' ? chat.unreadCount > 0 : this.applyToolFilters([chat]).length > 0;
      if (!bumped || !belongs || !matchesFilter) return;
      this.items.set([chat, ...list]);
      this.total.update((n) => n + 1);
      return;
    }

    const next = list.map((c, i) => (i === index ? { ...c, ...chat } : c));
    this.items.set(bumped ? [...next].sort(compareChatsByActivity) : next);
  }

  /**
   * A page requested before a hub update can land after it — keep whichever
   * copy of each chat has the newer activity.
   */
  private preferLive(page: readonly WaChat[]): WaChat[] {
    const live = this.seen();
    return page.map((c) => {
      const known = live.get(c.id);
      return known && compareChatsByActivity(known, c) < 0 ? known : c;
    });
  }

  private patchQuery(patch: Partial<ListQuery>): void {
    const current = this.query();
    const next = { ...current, ...patch };
    if (
      next.channelId === current.channelId &&
      next.search === current.search &&
      next.filter === current.filter &&
      next.label === current.label
    ) {
      return;
    }
    this.query.set(next);
  }

  private beginFirstPage(): void {
    this.version++;
    this.loading.set(true);
    this.loadingMore.set(false);
    this.error.set(null);
    // Never show the previous query's rows under a new one.
    this.items.set([]);
    this.total.set(0);
  }

  private setItems(list: WaChat[]): void {
    this.items.set(list);
    this.remember(list);
    this.session.noteChats(list);
  }

  private remember(list: readonly WaChat[]): void {
    if (!list.length) return;
    this.seen.update((current) => {
      const next = new Map(current);
      for (const chat of list) next.set(chat.id, chat);
      return next;
    });
  }

  /**
   * One read of the list. Resolves to the page, or to `null` on failure — a
   * failure only surfaces while the list is empty; otherwise the last good
   * list stays on screen.
   */
  private read(pageIndex: number, pageSize: number): Observable<Pagination<WaChat> | null> {
    const { channelId, search, filter, label } = this.query();
    const query: WaChatsQuery = {
      pageIndex,
      pageSize,
      search: search || undefined,
      instanceId: this.session.isAdmin() ? channelId ?? undefined : undefined,
      unreadOnly: filter === 'unread' || undefined,
      label: label || undefined,
      awaitingReply: filter === 'awaiting' || undefined,
      hasReminder: filter === 'followups' || undefined,
    };
    return this.api.chats(query).pipe(
      catchError((err) => {
        if (this.items().length === 0) {
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.loadChats'));
        }
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /**
   * The page is filtered and ordered by the server; re-applying the same
   * rules keeps live upserts and the clock honest (a replied chat leaves
   * «مستني رد» at once, a new label joins its filter without a reload).
   */
  private applyToolFilters(list: WaChat[]): WaChat[] {
    const { filter, label } = this.query();
    let out = label ? list.filter((c) => !!c.labels?.includes(label)) : list;
    if (filter === 'awaiting') {
      const now = this.now();
      const threshold = this.thresholdMinutes();
      out = out
        .filter((c) => isAwaitingReply(c, threshold, now))
        .sort((a, b) => compareByIso(a.awaitingReplySince, b.awaitingReplySince));
    } else if (filter === 'followups') {
      out = out.filter((c) => !!c.nextReminderAt).sort((a, b) => compareByIso(a.nextReminderAt, b.nextReminderAt));
    }
    return out;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
