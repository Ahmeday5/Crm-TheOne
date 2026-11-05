import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, filter, finalize, fromEvent, interval, map, merge, tap } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { AppHubService } from '../../../core/realtime/app-hub.service';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { ToastService } from '../../../core/services/toast.service';
import { cairoToday } from '../../../core/utils/cairo-time.util';
import { SessionTracker } from '../../../core/utils/session-tracker.util';
import { toAnnouncement } from '../data/announcement.mapper';
import { AnnouncementsRepository } from '../data/announcements.repository';
import {
  Announcement,
  AnnouncementDto,
  AnnouncementInput,
  AnnouncementQuery,
  AnnouncementReader,
  AnnouncementRemovedEvent,
} from '../models/announcement.models';
import {
  compareAnnouncements,
  coversDay,
  matchesSearch,
  upsertById,
} from '../utils/announcement.util';

export const ANNOUNCEMENTS_PATH = '/announcements';

/** Hub events on `/hubs/app`. */
const HUB_EVENTS = {
  created: 'announcement',
  updated: 'announcementUpdated',
  removed: 'announcementRemoved',
} as const;

/** Safety net for missed pushes (the hub is the primary signal). */
const ACTIVE_REFRESH_MS = 60 * 60_000;
/** How often "today" is re-evaluated — a new Cairo day reloads `/Active`. */
const CLOCK_MS = 60_000;

const DEFAULT_QUERY: AnnouncementQuery = { includeExpired: true, search: '' };

/**
 * App-wide announcements state: the sticky banner (`/Active`), the board
 * (`GET /Announcements`) and the sidebar unread badge.
 *
 * Booted once by `provideAnnouncements()`; follows the session (cleared on
 * sign-out / user switch). The server decides who sees what and when
 * something is live, so the store never filters by role or date itself —
 * it only reacts to hub pushes, the day rollover and reconnects.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsStore {
  private readonly repo = inject(AnnouncementsRepository);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(AppHubService);
  private readonly badges = inject(NavBadgesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  // ── banner (`/Active`) ──
  private readonly activeSig = signal<Announcement[]>([]);
  private activeSub?: Subscription;

  // ── board (`GET /Announcements`) ──
  private readonly boardSig = signal<Announcement[]>([]);
  private readonly querySig = signal<AnnouncementQuery>(DEFAULT_QUERY);
  private readonly boardLoadingSig = signal(false);
  private readonly boardLoadedSig = signal(false);
  private readonly boardErrorSig = signal(false);
  private boardSub?: Subscription;

  private readonly todaySig = signal(cairoToday());
  /** Publishes in flight — their own hub echo must not toast "new announcement". */
  private publishing = 0;
  private started = false;
  private readonly session = new SessionTracker();

  readonly today = this.todaySig.asReadonly();
  readonly query = this.querySig.asReadonly();
  readonly boardLoading = this.boardLoadingSig.asReadonly();
  readonly boardLoaded = this.boardLoadedSig.asReadonly();
  readonly boardError = this.boardErrorSig.asReadonly();

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** Banner: live today for this user, pinned first. */
  readonly bannerItems = computed(() => [...this.activeSig()].sort(compareAnnouncements));

  /** Board: everything the current query returned, pinned first. */
  readonly boardItems = computed(() => [...this.boardSig()].sort(compareAnnouncements));

  /** Unread live announcements — drives the sidebar badge. */
  readonly unreadCount = computed(() => this.activeSig().filter((a) => !a.isRead).length);

  constructor() {
    effect(() => this.badges.set(ANNOUNCEMENTS_PATH, this.unreadCount()), { allowSignalWrites: true });

    // Signed out / another user signed in: never show the previous user's
    // list or read receipts.
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => {
        if (!this.session.changed(userId)) return;
        this.reset();
        if (this.started && userId) this.refreshActive();
      });
    });
  }

  /** Idempotent — wires hub events, the day clock and the safety refresh. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.auth.isAuthenticated()) this.refreshActive();

    const live = <T>(source: Observable<T>) => source.pipe(takeUntilDestroyed(this.destroyRef));

    live(this.hub.on<AnnouncementDto>(HUB_EVENTS.created)).subscribe((dto) => this.onCreated(toAnnouncement(dto)));
    live(this.hub.on<AnnouncementDto>(HUB_EVENTS.updated)).subscribe((dto) => this.onUpdated(toAnnouncement(dto)));
    live(this.hub.on<AnnouncementRemovedEvent>(HUB_EVENTS.removed)).subscribe((e) => this.drop(Number(e?.id)));
    live(this.hub.reconnected$).subscribe(() => this.resync());

    // New Cairo day → announcements start / end on their own.
    live(
      merge(interval(CLOCK_MS), fromEvent(document, 'visibilitychange')).pipe(
        map(() => cairoToday()),
        filter((day) => day !== this.todaySig()),
      ),
    ).subscribe((day) => {
      this.todaySig.set(day);
      this.resync();
    });

    live(interval(ACTIVE_REFRESH_MS)).subscribe(() => this.refreshActive());
  }

  // ─────────── loading ───────────

  refreshActive(): void {
    if (!this.auth.isAuthenticated()) return;
    this.activeSub?.unsubscribe();
    this.activeSub = this.repo.active().subscribe({
      next: (rows) => this.activeSig.set(rows),
      // Keep what is on screen; the next tick / push retries.
      error: () => undefined,
    });
  }

  /** Loads the board for `query` (defaults to the current one). `quiet` keeps the list on screen. */
  loadBoard(query: Partial<AnnouncementQuery> = {}, quiet = false): void {
    const next = { ...this.querySig(), ...query };
    this.querySig.set(next);
    this.boardSub?.unsubscribe();
    if (!quiet) this.boardLoadingSig.set(true);
    this.boardErrorSig.set(false);
    this.boardSub = this.repo
      .list(next)
      .pipe(finalize(() => this.boardLoadingSig.set(false)))
      .subscribe({
        next: (rows) => {
          this.boardSig.set(rows);
          this.boardLoadedSig.set(true);
        },
        error: () => this.boardErrorSig.set(true),
      });
  }

  /** Look up a loaded announcement (board first, then banner). */
  find(id: number): Announcement | null {
    return this.boardSig().find((a) => a.id === id) ?? this.activeSig().find((a) => a.id === id) ?? null;
  }

  // ─────────── mutations (admin) ───────────

  publish(input: AnnouncementInput): Observable<Announcement | null> {
    this.publishing++;
    return this.repo.create(input).pipe(
      tap((saved) => {
        if (saved) this.mergeLocal(saved);
        this.resync();
      }),
      finalize(() => setTimeout(() => this.publishing--, 3_000)),
    );
  }

  update(id: number, input: AnnouncementInput): Observable<Announcement | null> {
    return this.repo.update(id, input).pipe(
      tap((saved) => {
        if (saved) this.mergeLocal(saved);
        this.resync();
      }),
    );
  }

  remove(id: number): Observable<void> {
    return this.repo.remove(id).pipe(tap(() => this.drop(id)));
  }

  readers(id: number): Observable<AnnouncementReader[]> {
    return this.repo.readers(id);
  }

  // ─────────── read receipts (everyone) ───────────

  /** Optimistic — a read receipt never blocks the UI; rolled back on failure. */
  markRead(a: Pick<Announcement, 'id' | 'isRead'>): void {
    if (a.isRead) return;
    this.patch(a.id, { isRead: true });
    this.repo.markRead(a.id).subscribe({
      error: () => this.patch(a.id, { isRead: false }),
    });
  }

  // ─────────── hub ───────────

  private onCreated(a: Announcement): void {
    const known = !!this.find(a.id);
    this.mergeLocal(a);
    if (!known && this.publishing === 0 && (a.isActive || coversDay(a, this.todaySig()))) {
      this.toast.info(interpolate(this.t('announcements.messages.incoming'), { title: a.title }));
    }
  }

  private onUpdated(a: Announcement): void {
    this.mergeLocal(a);
  }

  /** Merge a pushed / saved row into the banner and the board. */
  private mergeLocal(a: Announcement): void {
    const live = a.isActive || coversDay(a, this.todaySig());
    this.activeSig.update((list) => (live ? upsertById(list, a) : list.filter((x) => x.id !== a.id)));

    if (!this.boardLoadedSig()) return;
    const q = this.querySig();
    const visible = matchesSearch(a, q.search) && (q.includeExpired || live || this.todaySig() < a.startsOn);
    this.boardSig.update((list) => (visible ? upsertById(list, a) : list.filter((x) => x.id !== a.id)));
  }

  private drop(id: number): void {
    if (!Number.isFinite(id)) return;
    this.activeSig.update((list) => list.filter((a) => a.id !== id));
    this.boardSig.update((list) => list.filter((a) => a.id !== id));
  }

  private patch(id: number, changes: Partial<Announcement>): void {
    const apply = (list: Announcement[]) => list.map((a) => (a.id === id ? { ...a, ...changes } : a));
    this.activeSig.update(apply);
    this.boardSig.update(apply);
  }

  /** Server truth after a gap (reconnect, new day, own mutation). */
  private resync(): void {
    this.refreshActive();
    if (this.boardLoadedSig()) this.loadBoard({}, true);
  }

  private reset(): void {
    this.activeSub?.unsubscribe();
    this.boardSub?.unsubscribe();
    this.activeSig.set([]);
    this.boardSig.set([]);
    this.querySig.set(DEFAULT_QUERY);
    this.boardLoadedSig.set(false);
    this.boardLoadingSig.set(false);
    this.boardErrorSig.set(false);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
