import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Announcement } from '../../models/announcement.models';
import { ANNOUNCEMENTS_PATH, AnnouncementsStore } from '../../state/announcements.store';
import { TONE_ICON, daysLeft } from '../../utils/announcement.util';

const ROTATE_MS = 8_000;
const MINIMIZED_KEY = 'crm.announcements.banner.minimized';

/**
 * Sticky banner above every page while an announcement is live.
 *
 * Product rules:
 *   - It cannot be dismissed — only minimised to a slim bar.
 *   - It disappears on its own once the last day has passed (the store's
 *     day clock drops it from `bannerItems`).
 *   - Minimising remembers *which* announcements were showing; a newly
 *     published one re-expands the banner so it is never missed.
 */
@Component({
  selector: 'app-announcement-banner',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-banner.component.html',
  styleUrl: './announcement-banner.component.scss',
})
export class AnnouncementBannerComponent implements OnInit {
  private readonly store = inject(AnnouncementsStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = this.store.bannerItems;
  readonly index = signal(0);
  readonly paused = signal(false);
  private readonly minimizedIds = signal<ReadonlySet<string>>(this.loadMinimized());

  readonly current = computed<Announcement | null>(() => {
    const list = this.items();
    return list.length ? list[this.index() % list.length] : null;
  });

  readonly position = computed(() => (this.items().length ? (this.index() % this.items().length) + 1 : 0));

  /** Minimised only while every live announcement was already seen minimised. */
  readonly minimized = computed(() => {
    const list = this.items();
    const seen = this.minimizedIds();
    return list.length > 0 && list.every((a) => seen.has(a.id));
  });

  readonly unread = computed(() => this.items().filter((a) => !a.isRead).length);

  readonly rotating = computed(() => this.items().length > 1 && !this.paused() && !this.minimized());

  ngOnInit(): void {
    this.store.start();

    interval(ROTATE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.rotating() && !this.prefersReducedMotion()) this.next();
      });
  }

  // ─────────── actions ───────────

  next(): void {
    const n = this.items().length;
    if (n > 1) this.index.update((i) => (i + 1) % n);
  }

  prev(): void {
    const n = this.items().length;
    if (n > 1) this.index.update((i) => (i - 1 + n) % n);
  }

  minimize(): void {
    this.saveMinimized(new Set(this.items().map((a) => a.id)));
  }

  expand(): void {
    this.saveMinimized(new Set());
  }

  markRead(a: Announcement): void {
    this.store.markRead(a);
  }

  openDetails(a: Announcement): void {
    this.store.markRead(a);
    this.router.navigate([ANNOUNCEMENTS_PATH], { queryParams: { focus: a.id } });
  }

  // ─────────── view helpers ───────────

  icon(a: Announcement): string {
    return TONE_ICON[a.tone];
  }

  daysLeft(a: Announcement): number {
    return daysLeft(a, this.store.today());
  }

  // ─────────── internals ───────────

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private loadMinimized(): ReadonlySet<string> {
    try {
      const raw = JSON.parse(localStorage.getItem(MINIMIZED_KEY) ?? '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  private saveMinimized(ids: ReadonlySet<string>): void {
    this.minimizedIds.set(ids);
    try {
      localStorage.setItem(MINIMIZED_KEY, JSON.stringify([...ids]));
    } catch {
      /* per-viewer convenience only */
    }
  }
}
