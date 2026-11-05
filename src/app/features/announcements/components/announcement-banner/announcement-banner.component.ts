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
import { interval } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Announcement } from '../../models/announcement.models';
import { AnnouncementViewerService } from '../../state/announcement-viewer.service';
import { AnnouncementsStore } from '../../state/announcements.store';
import { announcementIcon, announcementTone, daysLeft } from '../../utils/announcement.util';
import { AnnouncementDetailDialogComponent } from '../announcement-detail-dialog/announcement-detail-dialog.component';

const ROTATE_MS = 6_000;
const MINIMIZED_KEY = 'crm.announcements.banner.minimized';

/**
 * Sticky banner above every page while an announcement is live for the
 * current user (`GET /Announcements/Active`).
 *
 * Product rules:
 *   - It cannot be dismissed — only minimised to a slim 📢 bar with a count.
 *   - Several live announcements rotate every 6 s (paused on hover / focus,
 *     never with reduced motion) and can be paged with the arrows.
 *   - It disappears on its own after the last day: the store reloads
 *     `/Active` on every new Cairo day and the server stops returning it.
 *   - Minimising remembers *which* announcements were showing (in
 *     localStorage, so it survives a refresh); a new one re-expands it.
 *   - Clicking an announcement opens it in full and marks it read. The
 *     detail dialog is hosted here because the banner lives on every page.
 */
@Component({
  selector: 'app-announcement-banner',
  standalone: true,
  imports: [TranslatePipe, AnnouncementDetailDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-banner.component.html',
  styleUrl: './announcement-banner.component.scss',
})
export class AnnouncementBannerComponent implements OnInit {
  private readonly store = inject(AnnouncementsStore);
  protected readonly viewer = inject(AnnouncementViewerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = this.store.bannerItems;
  readonly index = signal(0);
  readonly paused = signal(false);
  private readonly minimizedIds = signal<ReadonlySet<number>>(this.loadMinimized());

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

  /** Full text in a dialog (marks it read). */
  openDetails(a: Announcement): void {
    this.viewer.open(a);
  }

  // ─────────── view helpers ───────────

  icon(a: Announcement): string {
    return announcementIcon(a);
  }

  tone(a: Announcement): string {
    return announcementTone(a);
  }

  daysLeft(a: Announcement): number {
    return daysLeft(a, this.store.today());
  }

  // ─────────── internals ───────────

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private loadMinimized(): ReadonlySet<number> {
    try {
      const raw = JSON.parse(localStorage.getItem(MINIMIZED_KEY) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : []);
    } catch {
      return new Set();
    }
  }

  private saveMinimized(ids: ReadonlySet<number>): void {
    this.minimizedIds.set(ids);
    try {
      localStorage.setItem(MINIMIZED_KEY, JSON.stringify([...ids]));
    } catch {
      /* per-viewer convenience only */
    }
  }
}
