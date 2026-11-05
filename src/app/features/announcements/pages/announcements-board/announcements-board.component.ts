import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AnnouncementCardComponent } from '../../components/announcement-card/announcement-card.component';
import { AnnouncementFormDialogComponent } from '../../components/announcement-form-dialog/announcement-form-dialog.component';
import { AnnouncementReadersDialogComponent } from '../../components/announcement-readers-dialog/announcement-readers-dialog.component';
import { Announcement } from '../../models/announcement.models';
import { AnnouncementViewerService } from '../../state/announcement-viewer.service';
import { AnnouncementsStore } from '../../state/announcements.store';
import { announcementPhase } from '../../utils/announcement.util';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Announcements board — `/announcements` (and `/announcements/:id`, the
 * notification deep link, which opens that announcement).
 *
 * Sections: 📌 pinned → current (live / upcoming) → "previous" (no longer
 * live, faded). "Current only" asks the server for `includeExpired=false`;
 * search is server-side too. Publishing, editing, deleting and read stats
 * are Admin-only (the backend enforces it as well).
 */
@Component({
  selector: 'app-announcements-board',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    TranslatePipe,
    StatCardComponent,
    EmptyStateComponent,
    LoadErrorComponent,
    AnnouncementCardComponent,
    AnnouncementFormDialogComponent,
    AnnouncementReadersDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcements-board.component.html',
  styleUrl: './announcements-board.component.scss',
})
export class AnnouncementsBoardComponent implements OnInit {
  private readonly store = inject(AnnouncementsStore);
  private readonly viewer = inject(AnnouncementViewerService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);

  readonly isAdmin = this.store.isAdmin;
  readonly loading = this.store.boardLoading;
  readonly loaded = this.store.boardLoaded;
  readonly error = this.store.boardError;
  readonly today = this.store.today;

  // ─────────── filters ───────────
  readonly currentOnly = computed(() => !this.store.query().includeExpired);
  readonly searchText = signal(this.store.query().search);
  readonly unreadOnly = signal(false);
  private readonly search$ = new Subject<string>();

  // ─────────── dialogs / busy ───────────
  /** `undefined` = closed, `null` = create, value = edit. */
  readonly editing = signal<Announcement | null | undefined>(undefined);
  readonly readersOf = signal<Announcement | null>(null);
  readonly busyId = signal<number | null>(null);

  /** `/announcements/:id` (a notification or a shared link). */
  readonly focusId = toSignal(
    this.route.paramMap.pipe(map((p) => (p.get('id') ? Number(p.get('id')) : null))),
    { initialValue: null },
  );

  private readonly rows = computed(() =>
    this.store
      .boardItems()
      .map((a) => ({ a, phase: announcementPhase(a, this.today()) }))
      .filter((r) => !this.unreadOnly() || !r.a.isRead),
  );

  /** Pinned posts that are live or upcoming (pinned + finished goes to "previous"). */
  readonly pinned = computed(() => this.rows().filter((r) => r.a.isPinned && r.phase !== 'expired').map((r) => r.a));
  readonly current = computed(() => this.rows().filter((r) => !r.a.isPinned && r.phase !== 'expired').map((r) => r.a));
  readonly previous = computed(() => this.rows().filter((r) => r.phase === 'expired').map((r) => r.a));
  readonly isEmpty = computed(() => this.rows().length === 0);

  readonly counts = computed(() => {
    const all = this.store.boardItems();
    const reach = all.filter((a) => (a.targetCount ?? 0) > 0);
    const readRate = reach.length
      ? Math.round((reach.reduce((s, a) => s + (a.readCount ?? 0) / a.targetCount!, 0) / reach.length) * 100)
      : 0;
    return {
      active: all.filter((a) => a.isActive).length,
      unread: all.filter((a) => !a.isRead && a.isActive).length,
      pinned: all.filter((a) => a.isPinned && announcementPhase(a, this.today()) !== 'expired').length,
      previous: all.filter((a) => announcementPhase(a, this.today()) === 'expired').length,
      readRate,
    };
  });

  readonly hasFilters = computed(() => this.currentOnly() || this.unreadOnly() || !!this.searchText().trim());

  constructor() {
    this.search$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.store.loadBoard({ search }));

    // Deep link: open the announcement once it is known (board or banner).
    effect(() => {
      const id = this.focusId();
      if (id === null || !this.loaded()) return;
      untracked(() => {
        const target = this.store.find(id);
        if (!target) return;
        this.viewer.open(target);
        setTimeout(() =>
          document.getElementById(`announcement-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        );
      });
    });
  }

  ngOnInit(): void {
    // Always fresh on entry (read receipts / counts may have changed).
    this.store.loadBoard({}, this.loaded());
    // `?compose=1` (Ctrl+K "New announcement") opens the composer directly.
    if (this.isAdmin() && this.route.snapshot.queryParamMap.get('compose') === '1') {
      this.openCreate();
    }
  }

  reload(): void {
    this.store.loadBoard();
  }

  // ─────────── filters ───────────

  setCurrentOnly(on: boolean): void {
    if (on === this.currentOnly()) return;
    this.store.loadBoard({ includeExpired: !on });
  }

  onSearch(value: string): void {
    this.searchText.set(value);
    this.search$.next(value.trim());
  }

  clearFilters(): void {
    this.unreadOnly.set(false);
    this.searchText.set('');
    this.search$.next('');
    this.store.loadBoard({ includeExpired: true, search: '' });
  }

  // ─────────── actions ───────────

  open(a: Announcement): void {
    this.viewer.open(a);
  }

  markRead(a: Announcement): void {
    this.store.markRead(a);
  }

  openCreate(): void {
    this.editing.set(null);
  }

  openEdit(a: Announcement): void {
    this.editing.set(a);
  }

  closeForm(): void {
    this.editing.set(undefined);
  }

  async remove(a: Announcement): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('announcements.deleteDialog.title'),
      message: this.t('announcements.deleteDialog.message'),
      confirmText: this.t('announcements.delete'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(a.id);
    this.store.remove(a.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('announcements.messages.deleted'));
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.toast.error(err?.message?.trim() || this.t('announcements.messages.deleteFailed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
