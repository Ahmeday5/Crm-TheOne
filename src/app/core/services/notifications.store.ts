import { Injectable, computed, inject, signal } from '@angular/core';
import { NotificationsService } from './notifications.service';
import { NotificationToastService } from './notification-toast.service';
import { NotificationSoundService } from './notification-sound.service';
import { AppNotification } from '../../shared/models';

const PAGE_SIZE = 10;

/**
 * Global notifications store (bell badge + dropdown panel).
 *
 * Read actions are optimistic for instant feedback, then call the real
 * endpoint and re-read the authoritative unread-count from the server (the
 * backend is synchronous, so the confirmed value lands immediately). The
 * notification-center page keeps its own filtered list but routes its read
 * actions through here so the badge + bell stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsService);
  private readonly toasts = inject(NotificationToastService);
  private readonly sound = inject(NotificationSoundService);

  /** Highest notification id seen so far — anything above it is "new". */
  private lastSeenId = 0;
  /** Skip toasting the very first load (priming, not arrivals). */
  private primed = false;

  readonly unreadCount = signal(0);
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

  private readonly pageIndex = signal(1);
  private readonly totalCount = signal(0);

  readonly hasMore = computed(() => this.items().length < this.totalCount());

  // ─────────────── reads ───────────────

  loadUnreadCount(): void {
    this.api.unreadCount().subscribe({
      next: (res) => {
        const next = res?.unreadCount ?? 0;
        const prev = this.unreadCount();
        this.unreadCount.set(next);
        // Count rose → new notification(s) arrived; pull them in to toast.
        if (this.primed && next > prev) this.loadFirst();
      },
      error: () => {
        /* badge poll — keep the last good value */
      },
    });
  }

  /** Load the first page of the bell list. */
  loadFirst(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pageIndex.set(1);
    this.api.list({ PageIndex: 1, PageSize: PAGE_SIZE }).subscribe({
      next: (res) => {
        const data = res.data ?? [];
        this.items.set(data);
        this.totalCount.set(res.count ?? 0);
        this.loading.set(false);
        this.detectArrivals(data);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('load');
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = this.pageIndex() + 1;
    this.api.list({ PageIndex: next, PageSize: PAGE_SIZE }).subscribe({
      next: (res) => {
        this.pageIndex.set(next);
        const seen = new Set(this.items().map((n) => n.id));
        const fresh = (res.data ?? []).filter((n) => !seen.has(n.id));
        this.items.update((cur) => [...cur, ...fresh]);
        this.totalCount.set(res.count ?? this.totalCount());
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  /** Toast notifications newer than anything seen before (skips the first load). */
  private detectArrivals(data: AppNotification[]): void {
    const maxId = data.reduce((m, n) => Math.max(m, n.id), 0);
    if (!this.primed) {
      this.primed = true;
      this.lastSeenId = maxId;
      return;
    }
    const fresh = data
      .filter((n) => n.id > this.lastSeenId && !n.isRead)
      .sort((a, b) => a.id - b.id);
    for (const n of fresh) {
      this.toasts.show({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        relatedEntityType: n.relatedEntityType,
        relatedEntityId: n.relatedEntityId,
      });
    }
    // One chime per arrival batch — not one per notification.
    if (fresh.length > 0) this.sound.play();
    if (maxId > this.lastSeenId) this.lastSeenId = maxId;
  }

  // ─────────────── mutations ───────────────

  markRead(id: number): void {
    const target = this.items().find((n) => n.id === id);
    if (target?.isRead) return;
    this.setItemRead(id);
    this.unreadCount.update((c) => Math.max(0, c - 1));
    this.api.markRead(id).subscribe({
      next: () => this.loadUnreadCount(),
      error: () => this.syncFromServer(),
    });
  }

  markAllRead(): void {
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unreadCount.set(0);
    this.api.markAllRead().subscribe({
      next: () => this.loadUnreadCount(),
      error: () => this.syncFromServer(),
    });
  }

  private setItemRead(id: number): void {
    this.items.update((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  /** Pull the authoritative state back after a failed mutation. */
  private syncFromServer(): void {
    this.loadFirst();
    this.loadUnreadCount();
  }
}
