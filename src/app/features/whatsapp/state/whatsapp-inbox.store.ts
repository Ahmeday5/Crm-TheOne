import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { Pagination, WaChat, WaChatsQuery } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { pollWhileVisible } from '../utils/poll-while-visible.util';
import {
  WHATSAPP_CHATS_PAGE_SIZE,
  WHATSAPP_FALLBACK_POLL_MS,
  WHATSAPP_SEARCH_DEBOUNCE_MS,
  compareChatsByActivity,
  whatsappErrorText,
} from '../utils/whatsapp.util';
import { WhatsAppSessionStore } from './whatsapp-session.store';

/** The API caps `pageSize` here — a background refresh re-reads at most this many rows. */
const MAX_PAGE_SIZE = 100;

export type ChatsFilter = 'all' | 'unread';

interface ListQuery {
  /** Admin channel filter — `null` = all channels (employees are scoped server-side). */
  channelId: string | null;
  search: string;
  filter: ChatsFilter;
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

  private readonly query = signal<ListQuery>({ channelId: null, search: '', filter: 'all' });
  private readonly items = signal<WaChat[]>([]);
  private readonly total = signal(0);
  /** Every chat seen this visit — the open chat keeps its header when filtered out. */
  private readonly seen = signal<ReadonlyMap<number, WaChat>>(new Map());

  readonly channelId = computed(() => this.query().channelId);
  readonly search = computed(() => this.query().search);
  readonly filter = computed(() => this.query().filter);
  readonly activeChatId = signal<number | null>(null);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);

  /** The open chat always shows as read — the thread marks it read itself. */
  readonly chats = computed<WaChat[]>(() => {
    const active = this.activeChatId();
    return this.items().map((c) => (c.id === active && c.unreadCount ? { ...c, unreadCount: 0 } : c));
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
      .subscribe((chat) => this.upsert(chat, false));

    // Catch up after a gap; keep fresh by polling only while the hub is down.
    merge(
      this.realtime.reconnected$,
      toObservable(this.realtime.state, { injector: this.injector }).pipe(
        switchMap((state) => (state === 'reconnecting' ? pollWhileVisible(WHATSAPP_FALLBACK_POLL_MS) : EMPTY)),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  // ─────────────── query ───────────────

  setSearch(term: string): void {
    this.searchInput.next(term);
  }

  setFilter(filter: ChatsFilter): void {
    this.patchQuery({ filter });
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
      const matchesFilter = filter === 'all' || chat.unreadCount > 0;
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
    if (next.channelId === current.channelId && next.search === current.search && next.filter === current.filter) {
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
    const { channelId, search, filter } = this.query();
    const query: WaChatsQuery = {
      pageIndex,
      pageSize,
      search: search || undefined,
      instanceId: this.session.isAdmin() ? channelId ?? undefined : undefined,
      unreadOnly: filter === 'unread' || undefined,
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

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
