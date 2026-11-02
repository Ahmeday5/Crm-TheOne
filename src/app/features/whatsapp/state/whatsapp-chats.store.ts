import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  map,
  of,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { PagedResult } from '../../../shared/models';
import { WhatsAppChat } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { pollWhileVisible } from '../utils/poll-while-visible.util';
import {
  WHATSAPP_CHATS_PAGE_SIZE,
  WHATSAPP_CHATS_POLL_MS,
  whatsappErrorText,
} from '../utils/whatsapp.util';

/** A background refresh re-reads at most this many chats in one request. */
const MAX_REFRESH_WINDOW = 100;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * The inbox's conversation list. Provided by the inbox page.
 *
 * The server scopes the list (Admin: everyone's chats, employee: own), sorts
 * it by latest activity and filters by `Search`. A poll every 15 s re-reads
 * the window already on screen so new chats and badges appear without losing
 * the user's scroll depth. The open chat's badge is always shown as zero —
 * the thread marks it read itself.
 */
@Injectable()
export class WhatsAppChatsStore {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly items = signal<WhatsAppChat[]>([]);
  private readonly total = signal(0);

  readonly search = signal('');
  readonly activeChatId = signal<number | null>(null);
  /** First page of the current search. */
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);

  readonly chats = computed<WhatsAppChat[]>(() => {
    const active = this.activeChatId();
    return this.items().map((c) => (c.id === active && c.unreadCount ? { ...c, unreadCount: 0 } : c));
  });
  readonly hasMore = computed(() => this.items().length < this.total());
  readonly activeChat = computed(() => this.chats().find((c) => c.id === this.activeChatId()) ?? null);
  readonly totalUnread = computed(() => this.chats().reduce((sum, c) => sum + (c.unreadCount || 0), 0));

  private readonly searchInput = new Subject<string>();
  private requestSeq = 0;
  private appliedSeq = 0;
  private started = false;

  /** Load the first page and start polling. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.searchInput
      .pipe(
        map((term) => term.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((term) => {
        this.search.set(term);
        this.reload();
      });

    pollWhileVisible(WHATSAPP_CHATS_POLL_MS)
      .pipe(
        exhaustMap(() => this.read(1, this.refreshWindow())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => page && this.applyWindow(page));

    this.reload();
  }

  setSearch(term: string): void {
    this.searchInput.next(term);
  }

  setActive(chatId: number | null): void {
    this.activeChatId.set(chatId);
  }

  /** Fresh first page (initial load, new search, retry). */
  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    // Never show the previous search's rows under a new query.
    this.items.set([]);
    this.total.set(0);
    this.read(1, WHATSAPP_CHATS_PAGE_SIZE).subscribe((page) => {
      this.loading.set(false);
      if (!page) return;
      this.items.set(page.data);
      this.total.set(page.count);
    });
  }

  /** Re-read the visible window now (manual refresh, notification, a reply sent). */
  refresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.read(1, this.refreshWindow()).subscribe((page) => {
      this.refreshing.set(false);
      if (page) this.applyWindow(page);
    });
  }

  loadMore(): void {
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = Math.floor(this.items().length / WHATSAPP_CHATS_PAGE_SIZE) + 1;
    this.read(next, WHATSAPP_CHATS_PAGE_SIZE, false).subscribe((page) => {
      this.loadingMore.set(false);
      if (!page) return;
      // New activity can shift rows between pages — never show a chat twice.
      const seen = new Set(this.items().map((c) => c.id));
      this.items.update((list) => [...list, ...page.data.filter((c) => !seen.has(c.id))]);
      this.total.set(page.count);
    });
  }

  /** Optimistic: the thread just marked this chat read on the server. */
  markReadLocally(chatId: number): void {
    this.items.update((list) => list.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
  }

  // ─────────────── internals ───────────────

  private refreshWindow(): number {
    return Math.min(MAX_REFRESH_WINDOW, Math.max(WHATSAPP_CHATS_PAGE_SIZE, this.items().length));
  }

  private applyWindow(page: PagedResult<WhatsAppChat>): void {
    // Keep rows loaded beyond the refreshed window (deep "load more" lists).
    const fresh = new Set(page.data.map((c) => c.id));
    const tail = this.items().slice(page.data.length).filter((c) => !fresh.has(c.id));
    this.items.set([...page.data, ...tail]);
    this.total.set(page.count);
    this.error.set(null);
  }

  /**
   * One read of the list. Resolves to the page, or to `null` when the answer
   * is stale (the search changed meanwhile, or — for `ordered` reads — a newer
   * read already landed) or when it failed. A failure only surfaces while the
   * list is empty; otherwise the last good list stays on screen.
   */
  private read(
    pageIndex: number,
    pageSize: number,
    ordered = true,
  ): Observable<PagedResult<WhatsAppChat> | null> {
    const seq = ++this.requestSeq;
    const search = this.search();

    return this.api
      .chats({ PageIndex: pageIndex, PageSize: pageSize, Search: search || undefined })
      .pipe(
        map((page) => {
          if (search !== this.search()) return null;
          if (ordered) {
            if (seq < this.appliedSeq) return null;
            this.appliedSeq = seq;
          }
          return page;
        }),
        catchError((err) => {
          if (search === this.search() && this.items().length === 0) {
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
