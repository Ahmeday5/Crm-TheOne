import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Observable,
  Subject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { formatCalendarDate } from '../../../../core/utils/calendar-date.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  DailyReport,
  DailyReportListItem,
  DailyReportListQuery,
  PagedResult,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DailyReportDetailsDialogComponent } from '../../components/daily-report-details-dialog/daily-report-details-dialog.component';
import { DailyReportFormDialogComponent } from '../../components/daily-report-form-dialog/daily-report-form-dialog.component';
import { DailyReportsService } from '../../services/daily-reports.service';

type ScopeFilter = 'all' | 'mine';

/** Quick date-range presets surfaced as a segmented control. */
type RangePreset =
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'thisYear'
  | 'custom';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PRESET: RangePreset = 'thisMonth';
const PRESET_ORDER: readonly RangePreset[] = [
  'thisMonth',
  'lastMonth',
  'last3Months',
  'thisYear',
  'custom',
];

/**
 * Daily reports landing page.
 *
 * Two scopes share the same UI:
 *   - Admins see every user's reports (`GET /Reports`) and can flip a toggle
 *     to view just their own (`GET /Reports/myreports`).
 *   - Non-admins only ever hit `/myreports`; the scope toggle is hidden.
 *
 * The period filter exposes quick presets (this/last month, last 3 months,
 * this year) plus a custom `From`/`To` range; whichever is active resolves to
 * `FromDate`/`ToDate` query params so the server handles filtering — the page
 * never paginates client-side.
 */
@Component({
  selector: 'app-daily-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
    StatCardComponent,
    PaginationComponent,
    TableToolsComponent,
    DailyReportFormDialogComponent,
    DailyReportDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-reports.component.html',
  styleUrl: './daily-reports.component.scss',
})
export class DailyReportsComponent implements OnInit, OnDestroy {
  private readonly reports = inject(DailyReportsService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly rows = signal<DailyReportListItem[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Per-row spinner. */
  readonly busyId = signal<number | null>(null);

  // ─── filters ───
  searchTerm = '';
  readonly searchSignal = signal('');
  readonly preset = signal<RangePreset>(DEFAULT_PRESET);
  readonly customFrom = signal<string>('');
  readonly customTo = signal<string>('');
  readonly presets = PRESET_ORDER;
  /** Admin-only — flips between every-user and current-user reports. */
  readonly scope = signal<ScopeFilter>('all');

  // ─── pagination ───
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);

  // ─── dialogs ───
  readonly formOpen = signal(false);
  readonly editTarget = signal<DailyReport | null>(null);
  readonly detailsId = signal<number | null>(null);

  /** True when the current user is an Admin (drives scope toggle visibility). */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /**
   * KPIs derived from the current page's rows. The backend doesn't expose a
   * dedicated stats endpoint for reports yet, so we aggregate the visible
   * page — total uses the page envelope's `count`, which reflects the full
   * filtered result set.
   */
  readonly kpis = computed(() => {
    const list = this.rows();
    const totalHours = list.reduce((s, r) => s + (r.workHours ?? 0), 0);
    const avgHours = list.length ? totalHours / list.length : 0;
    return {
      total: this.totalCount(),
      submitted: list.length,
      reviewed: 0,
      avgHours: Math.round(avgHours * 10) / 10,
    };
  });

  /**
   * The `{ fromDate, toDate }` the active preset (or custom range) resolves to.
   * A custom range with an inverted from/to yields an empty range so we never
   * send a nonsensical query — the template surfaces an inline hint instead.
   */
  readonly dateRange = computed<{ fromDate?: string; toDate?: string }>(() => {
    const preset = this.preset();

    if (preset === 'custom') {
      const from = this.customFrom();
      const to = this.customTo();
      if (from && to && from > to) return {};
      return { fromDate: from || undefined, toDate: to || undefined };
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const pad = (n: number) => n.toString().padStart(2, '0');
    const ymd = (yr: number, mo0: number, day: number) =>
      `${yr}-${pad(mo0 + 1)}-${pad(day)}`;
    const lastDay = (yr: number, mo0: number) =>
      new Date(yr, mo0 + 1, 0).getDate();

    switch (preset) {
      case 'lastMonth': {
        const d = new Date(y, m - 1, 1);
        const ly = d.getFullYear();
        const lm = d.getMonth();
        return { fromDate: ymd(ly, lm, 1), toDate: ymd(ly, lm, lastDay(ly, lm)) };
      }
      case 'last3Months': {
        const d = new Date(y, m - 2, 1);
        return {
          fromDate: ymd(d.getFullYear(), d.getMonth(), 1),
          toDate: ymd(y, m, lastDay(y, m)),
        };
      }
      case 'thisYear':
        return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
      case 'thisMonth':
      default:
        return { fromDate: ymd(y, m, 1), toDate: ymd(y, m, lastDay(y, m)) };
    }
  });

  /** True while a custom range has both ends set but inverted. */
  readonly invalidRange = computed(() => {
    if (this.preset() !== 'custom') return false;
    const from = this.customFrom();
    const to = this.customTo();
    return !!from && !!to && from > to;
  });

  /** Human-readable label of the range currently driving the list. */
  readonly activeRangeLabel = computed(() => {
    const { fromDate, toDate } = this.dateRange();
    if (!fromDate && !toDate) return '—';
    return `${this.formatDate(fromDate)} ← ${this.formatDate(toDate)}`;
  });

  /** Whether any filter deviates from its default — drives the clear button. */
  readonly hasActiveFilters = computed(
    () =>
      this.searchSignal().trim().length > 0 ||
      this.preset() !== DEFAULT_PRESET ||
      (this.isAdmin() && this.scope() !== 'all'),
  );

  presetLabelKey(preset: RangePreset): string {
    return `dailyReports.filters.presets.${preset}`;
  }

  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });
    // Non-admins are pinned to "mine" — the toggle never renders for them.
    if (!this.isAdmin()) this.scope.set('mine');
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);

    const { fromDate, toDate } = this.dateRange();
    const query: DailyReportListQuery = {
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
      search: this.searchSignal().trim() || undefined,
      fromDate,
      toDate,
    };

    const useMine = !this.isAdmin() || this.scope() === 'mine';
    const request$: Observable<PagedResult<DailyReportListItem>> = useMine
      ? this.reports.myReports(query, force)
      : this.reports.list(query, force);

    request$.subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.totalCount.set(res.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('dailyReports.messages.loadFailed'));
      },
    });
  }

  // ─────────── filters / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onPresetChange(preset: RangePreset): void {
    if (this.preset() === preset) return;
    this.preset.set(preset);
    this.pageIndex.set(1);
    // Switching *into* custom waits for the user to pick dates; every other
    // preset resolves to a range immediately, so refetch now.
    if (preset !== 'custom') this.reload();
  }

  onCustomFromChange(value: string): void {
    this.customFrom.set(value);
    this.applyCustomRange();
  }

  onCustomToChange(value: string): void {
    this.customTo.set(value);
    this.applyCustomRange();
  }

  /** Refetch once the custom range is coherent (and not inverted). */
  private applyCustomRange(): void {
    if (this.invalidRange()) return;
    this.pageIndex.set(1);
    this.reload();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.searchSignal.set('');
    this.preset.set(DEFAULT_PRESET);
    this.customFrom.set('');
    this.customTo.set('');
    this.scope.set(this.isAdmin() ? 'all' : 'mine');
    this.pageIndex.set(1);
    this.reload();
  }

  onScopeChange(value: ScopeFilter): void {
    if (!this.isAdmin()) return;
    this.scope.set(value);
    this.pageIndex.set(1);
    this.reload();
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
  }

  // ─────────── create / edit ───────────

  openCreate(): void {
    this.editTarget.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: DailyReportListItem | DailyReport): void {
    // The card only carries a preview, so we fetch the full record before
    // opening the dialog. Existing `details` cache makes this a no-op when
    // the user has already viewed the report this session.
    this.busyId.set(row.id);
    this.reports.getById(row.id).subscribe({
      next: (full) => {
        this.busyId.set(null);
        this.editTarget.set(full);
        this.detailsId.set(null);
        this.formOpen.set(true);
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  openEditFromDetails(report: DailyReport): void {
    this.detailsId.set(null);
    this.editTarget.set(report);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editTarget.set(null);
  }

  onCreated(): void {
    this.closeForm();
    this.reload();
  }

  onUpdated(): void {
    this.closeForm();
    this.reload();
  }

  // ─────────── details ───────────

  openDetails(row: DailyReportListItem): void {
    this.detailsId.set(row.id);
  }

  closeDetails(): void {
    this.detailsId.set(null);
  }

  // ─────────── delete ───────────

  async confirmDelete(row: DailyReportListItem): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('dailyReports.deleteDialog.title'),
      message: this.t('dailyReports.deleteDialog.message'),
      confirmText: this.t('dailyReports.deleteDialog.confirm'),
      cancelText: this.t('dailyReports.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.reports.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('dailyReports.messages.deleted'));
        if (this.rows().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── helpers ───────────

  formatNumber(n: number): string {
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  formatHours(n: number): string {
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 1,
    });
  }

  formatDate(value: string | null | undefined): string {
    return formatCalendarDate(
      value,
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
    );
  }

  /**
   * Card preview text — trims long descriptions so the grid stays uniform.
   * The full body is loaded lazily in the details modal.
   */
  previewText(value: string | null | undefined, max = 140): string {
    if (!value) return '-';
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max).trimEnd() + '…';
  }

  // ─────────── export / print ───────────

  get exportColumns(): ExportColumn<DailyReportListItem>[] {
    return [
      { header: this.t('dailyReports.export.id'), value: (r) => r.id },
      {
        header: this.t('dailyReports.export.employee'),
        value: (r) => r.userName,
      },
      {
        header: this.t('dailyReports.export.reportDate'),
        value: (r) => this.formatDate(r.reportDate),
      },
      {
        header: this.t('dailyReports.export.workHours'),
        value: (r) => r.workHours,
        align: 'center',
      },
      {
        header: this.t('dailyReports.export.summary'),
        value: (r) => r.completedTasksPreview,
      },
      {
        header: this.t('dailyReports.export.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
    ];
  }

  readonly fetchAllRows = async (): Promise<DailyReportListItem[]> => {
    const { fromDate, toDate } = this.dateRange();
    const query: DailyReportListQuery = {
      pageIndex: 1,
      pageSize: this.totalCount() || this.pageSize(),
      search: this.searchSignal().trim() || undefined,
      fromDate,
      toDate,
    };
    const useMine = !this.isAdmin() || this.scope() === 'mine';
    const res = await firstValueFrom(
      useMine ? this.reports.myReports(query) : this.reports.list(query),
    );
    return res.data ?? [];
  };

  trackById = (_: number, r: DailyReportListItem) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
