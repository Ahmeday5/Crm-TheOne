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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
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
import { Announcement, AnnouncementPhase } from '../../models/announcement.models';
import { AnnouncementsStore } from '../../state/announcements.store';
import { announcementPhase } from '../../utils/announcement.util';

type PhaseFilter = 'all' | AnnouncementPhase;

@Component({
  selector: 'app-announcements-board',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    StatCardComponent,
    EmptyStateComponent,
    LoadErrorComponent,
    AnnouncementCardComponent,
    AnnouncementFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcements-board.component.html',
  styleUrl: './announcements-board.component.scss',
})
export class AnnouncementsBoardComponent implements OnInit {
  private readonly store = inject(AnnouncementsStore);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);

  readonly phases: PhaseFilter[] = ['all', 'active', 'scheduled', 'expired'];

  readonly isAdmin = this.store.isAdmin;
  readonly loading = this.store.loading;
  readonly loaded = this.store.loaded;
  readonly error = this.store.error;
  readonly today = this.store.today;

  // ─────────── filters ───────────
  readonly phase = signal<PhaseFilter>('all');
  readonly unreadOnly = signal(false);
  readonly search = signal('');

  // ─────────── dialogs / busy ───────────
  /** `undefined` = closed, `null` = create, value = edit. */
  readonly editing = signal<Announcement | null | undefined>(undefined);
  readonly busyId = signal<string | null>(null);

  /** `?focus=<id>` from the banner / a notification. */
  readonly focusId = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('focus'))), {
    initialValue: null,
  });

  private readonly withPhase = computed(() =>
    this.store.items().map((a) => ({ a, phase: announcementPhase(a, this.today()) })),
  );

  readonly counts = computed(() => {
    const rows = this.withPhase();
    const count = (p: PhaseFilter) => (p === 'all' ? rows.length : rows.filter((r) => r.phase === p).length);
    const reach = rows.filter((r) => r.a.recipientsCount > 0);
    const readRate = reach.length
      ? Math.round(
          (reach.reduce((s, r) => s + r.a.readCount / r.a.recipientsCount, 0) / reach.length) * 100,
        )
      : 0;
    return {
      all: count('all'),
      active: count('active'),
      scheduled: count('scheduled'),
      expired: count('expired'),
      pinned: rows.filter((r) => r.a.isPinned).length,
      unread: this.store.unreadCount(),
      readRate,
    };
  });

  private readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const phase = this.phase();
    return this.withPhase()
      .filter((r) => phase === 'all' || r.phase === phase)
      .filter((r) => !this.unreadOnly() || !r.a.isRead)
      .filter((r) => !q || r.a.title.toLowerCase().includes(q) || r.a.body.toLowerCase().includes(q))
      .map((r) => r.a);
  });

  readonly pinned = computed(() => this.filtered().filter((a) => a.isPinned));
  readonly others = computed(() => this.filtered().filter((a) => !a.isPinned));
  readonly hasFilters = computed(() => this.phase() !== 'all' || this.unreadOnly() || !!this.search().trim());

  constructor() {
    // Bring the deep-linked card into view once the list is there.
    effect(() => {
      const id = this.focusId();
      if (!id || !this.loaded()) return;
      untracked(() => {
        const target = this.store.items().find((a) => a.id === id);
        if (!target) return;
        this.store.markRead(target);
        if (this.phase() !== 'all' && announcementPhase(target, this.today()) !== this.phase()) {
          this.phase.set('all');
        }
        setTimeout(() =>
          document
            .getElementById(`announcement-${id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        );
      });
    });
  }

  ngOnInit(): void {
    this.store.start();
    // `?compose=1` (Ctrl+K "New announcement") opens the composer directly.
    if (this.isAdmin() && this.route.snapshot.queryParamMap.get('compose') === '1') {
      this.openCreate();
    }
  }

  reload(): void {
    this.store.refresh();
  }

  clearFilters(): void {
    this.phase.set('all');
    this.unreadOnly.set(false);
    this.search.set('');
  }

  // ─────────── actions ───────────

  openCreate(): void {
    this.editing.set(null);
  }

  openEdit(a: Announcement): void {
    this.editing.set(a);
  }

  closeForm(): void {
    this.editing.set(undefined);
  }

  markRead(a: Announcement): void {
    this.store.markRead(a);
  }

  togglePin(a: Announcement): void {
    this.busyId.set(a.id);
    this.store.togglePin(a).subscribe({
      next: (saved) => {
        this.busyId.set(null);
        this.toast.success(this.t(saved.isPinned ? 'announcements.messages.pinned' : 'announcements.messages.unpinned'));
      },
      error: (err: ApiError) => this.fail(err),
    });
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
      error: (err: ApiError) => this.fail(err),
    });
  }

  private fail(err: ApiError): void {
    this.busyId.set(null);
    this.toast.error(err?.message?.trim() || this.t('announcements.messages.saveFailed'));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
