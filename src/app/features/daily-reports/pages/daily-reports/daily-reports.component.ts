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
import { Observable, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { formatCalendarDate } from '../../../../core/utils/calendar-date.util';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
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

const DEFAULT_PAGE_SIZE = 10;
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthOption {
  value: number; // 1..12
  label: string;
}

/**
 * Daily reports landing page.
 *
 * Two scopes share the same UI:
 *   - Admins see every user's reports (`GET /Reports`) and can flip a toggle
 *     to view just their own (`GET /Reports/myreports`).
 *   - Non-admins only ever hit `/myreports`; the scope toggle is hidden.
 *
 * Month/year selectors translate to `FromDate`/`ToDate` query params so the
 * server handles filtering — the page never paginates client-side.
 */
@Component({
  selector: 'app-daily-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    StatCardComponent,
    PaginationComponent,
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
  readonly selectedMonth = signal<number>(new Date().getMonth() + 1);
  readonly selectedYear = signal<number>(new Date().getFullYear());
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

  readonly months = computed<MonthOption[]>(() => {
    const labels = this.language.lang() === 'ar' ? ARABIC_MONTHS : ENGLISH_MONTHS;
    return labels.map((label, i) => ({ value: i + 1, label }));
  });

  readonly years = computed<number[]>(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  });

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

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const { fromDate, toDate } = this.monthRange(this.selectedYear(), this.selectedMonth());
    const query: DailyReportListQuery = {
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
      search: this.searchSignal().trim() || undefined,
      fromDate,
      toDate,
    };

    const useMine = !this.isAdmin() || this.scope() === 'mine';
    const request$: Observable<PagedResult<DailyReportListItem>> = useMine
      ? this.reports.myReports(query)
      : this.reports.list(query);

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

  onMonthChange(value: number | string): void {
    const month = Number(value);
    if (!Number.isFinite(month) || month < 1 || month > 12) return;
    this.selectedMonth.set(month);
    this.pageIndex.set(1);
    this.reload();
  }

  onYearChange(value: number | string): void {
    const year = Number(value);
    if (!Number.isFinite(year)) return;
    this.selectedYear.set(year);
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

  trackById = (_: number, r: DailyReportListItem) => r.id;

  private monthRange(year: number, month: number): { fromDate: string; toDate: string } {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      fromDate: `${year}-${pad(month)}-01`,
      toDate: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
