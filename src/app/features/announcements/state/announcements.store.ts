import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize, fromEvent, interval, merge, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { ANNOUNCEMENTS_REPOSITORY } from '../data/announcements-repository.provider';
import { Announcement, AnnouncementInput } from '../models/announcement.models';
import { announcementPhase, cairoToday, compareAnnouncements } from '../utils/announcement.util';

/** Background refresh — new announcements reach open tabs without a reload. */
const REFRESH_MS = 5 * 60_000;
/** Re-evaluates "today" so banners appear/disappear at midnight on their own. */
const CLOCK_MS = 60_000;
export const ANNOUNCEMENTS_PATH = '/announcements';

/**
 * App-wide announcements state (board page, global banner, sidebar badge).
 *
 * `start()` is called once by the shell; it loads, keeps the list fresh and
 * ticks the day clock. All mutations go through here so every consumer
 * updates together.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsStore {
  private readonly repo = inject(ANNOUNCEMENTS_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly badges = inject(NavBadgesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly itemsSig = signal<Announcement[]>([]);
  private readonly loadingSig = signal(false);
  private readonly loadedSig = signal(false);
  private readonly errorSig = signal(false);
  private readonly todaySig = signal(cairoToday());
  private started = false;
  private loadSub?: Subscription;

  readonly loading = this.loadingSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly error = this.errorSig.asReadonly();
  readonly today = this.todaySig.asReadonly();

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** Everything the user may see — pinned first, newest next. */
  readonly items = computed(() => [...this.itemsSig()].sort(compareAnnouncements));

  /** Live right now (inside the window). */
  readonly active = computed(() =>
    this.items().filter((a) => announcementPhase(a, this.todaySig()) === 'active'),
  );

  /**
   * What the global banner shows: live announcements that actually target
   * this user's department. An admin is only a recipient of "everyone" posts.
   */
  readonly bannerItems = computed(() => {
    const role = this.auth.currentRole();
    return this.active().filter(
      (a) => a.audience === 'all' || (!!role && (a.roles as string[]).includes(role)),
    );
  });

  /** Unread and not expired — drives the sidebar badge. */
  readonly unreadCount = computed(
    () =>
      this.items().filter(
        (a) => !a.isRead && announcementPhase(a, this.todaySig()) !== 'expired',
      ).length,
  );

  constructor() {
    effect(() => this.badges.set(ANNOUNCEMENTS_PATH, this.unreadCount()));

    // A different user signed in (or signed out): never show the previous
    // user's list or read receipts.
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => {
        this.itemsSig.set([]);
        this.loadedSig.set(false);
        if (this.started && userId) this.refresh();
      });
    });
  }

  /** Idempotent — wires refresh, the day clock and cross-tab sync. */
  start(): void {
    if (this.started) {
      if (!this.loadedSig()) this.refresh();
      return;
    }
    this.started = true;
    this.refresh();

    interval(CLOCK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.todaySig.set(cairoToday()));

    merge(
      interval(REFRESH_MS),
      this.repo.externalChanges$,
      fromEvent(document, 'visibilitychange').pipe(tap(() => this.todaySig.set(cairoToday()))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible' && this.auth.isAuthenticated()) {
          this.refresh(true);
        }
      });
  }

  /** `quiet` keeps the current list on screen (no spinner). */
  refresh(quiet = false): void {
    this.loadSub?.unsubscribe();
    if (!quiet) this.loadingSig.set(true);
    this.errorSig.set(false);
    this.loadSub = this.repo
      .list()
      .pipe(finalize(() => this.loadingSig.set(false)))
      .subscribe({
        next: (rows) => {
          this.itemsSig.set(rows);
          this.loadedSig.set(true);
        },
        error: () => this.errorSig.set(true),
      });
  }

  // ─────────── mutations (admin) ───────────

  publish(input: AnnouncementInput): Observable<Announcement> {
    return this.repo.create(input).pipe(tap((a) => this.upsert(a)));
  }

  update(id: string, input: AnnouncementInput): Observable<Announcement> {
    return this.repo.update(id, input).pipe(tap((a) => this.upsert(a)));
  }

  remove(id: string): Observable<void> {
    return this.repo
      .remove(id)
      .pipe(tap(() => this.itemsSig.update((list) => list.filter((a) => a.id !== id))));
  }

  togglePin(a: Announcement): Observable<Announcement> {
    return this.repo.setPinned(a.id, !a.isPinned).pipe(tap((saved) => this.upsert(saved)));
  }

  // ─────────── mutations (everyone) ───────────

  /** Optimistic — a read receipt never needs to block the UI. */
  markRead(a: Announcement): void {
    if (a.isRead) return;
    const readAt = new Date().toISOString();
    this.itemsSig.update((list) =>
      list.map((x) => (x.id === a.id ? { ...x, isRead: true, readAt } : x)),
    );
    this.repo.markRead(a.id).subscribe({
      error: () =>
        this.itemsSig.update((list) =>
          list.map((x) => (x.id === a.id ? { ...x, isRead: false, readAt: null } : x)),
        ),
    });
  }

  private upsert(a: Announcement): void {
    this.itemsSig.update((list) =>
      list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list],
    );
  }
}
