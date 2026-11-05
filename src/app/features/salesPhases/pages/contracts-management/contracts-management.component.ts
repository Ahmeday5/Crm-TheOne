import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CONTRACTS_MAX_PAGE_SIZE,
  ContractListItem,
  ContractListQuery,
  ContractStatistics,
  PagedResult,
  SalesPerson,
} from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractFormDialogComponent } from '../../components/contract-form-dialog/contract-form-dialog.component';
import { ContractsService } from '../../services/contracts.service';
import {
  ContractLifecycle,
  contractLifecycle,
  daysUntilEnd,
} from '../../utils/contract-lifecycle.util';
import {
  CONTRACT_TABS,
  ContractTab,
  contractTabCount,
  contractTabFilter,
} from '../../utils/contract-tabs.util';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, CONTRACTS_MAX_PAGE_SIZE];
const SEARCH_DEBOUNCE_MS = 300;

const BADGES: Record<ContractLifecycle, string> = {
  active: 'bg-success-subtle text-success',
  expiring: 'bg-warning-subtle text-warning',
  expired: 'bg-danger-subtle text-danger',
  cancelled: 'bg-secondary-subtle text-secondary',
};

const LABELS: Record<ContractLifecycle, string> = {
  active: 'active',
  expiring: 'expiringSoon',
  expired: 'expired',
  cancelled: 'cancelled',
};

type PageLoad =
  | { ok: true; page: PagedResult<ContractListItem> }
  | { ok: false };

/**
 * Contracts management — fully server-driven.
 *
 *  - KPI tiles + tab badges come from `GET Contracts/ContractStatistics`,
 *    scoped by the server (Admin: everything, sales reps: their own).
 *  - The table comes from `GET Contracts/GetContracts` with the tab filter,
 *    search and `pageIndex`/`pageSize`; the total is the page `count`.
 *
 * Page requests flow through one `switchMap`, so a slow response for an
 * older tab / page / search can never overwrite a newer one. Every
 * mutation reloads both statistics and the current page.
 */
@Component({
  selector: 'app-contracts-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    MoneyPipe,
    EmptyStateComponent,
    PageHeaderComponent,
    StatCardComponent,
    PaginationComponent,
    LoadErrorComponent,
    TableToolsComponent,
    ContractFormDialogComponent,
    ResponsiveTableDirective,
    ClampTextDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contracts-management.component.html',
  styleUrl: './contracts-management.component.scss',
})
export class ContractsManagementComponent implements OnInit {
  private readonly service = inject(ContractsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly tabs = CONTRACT_TABS;
  /** The sales-rep filter is Admin-only (a rep only ever sees their own contracts). */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── query state ──
  readonly activeTab = signal<ContractTab>('all');
  readonly search = signal('');
  /** `SalesPersonId` filter — `null` = everyone. */
  readonly salesPersonId = signal<string | null>(null);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  // ── current page (server) ──
  readonly rows = signal<ContractListItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── statistics (server) ──
  readonly stats = signal<ContractStatistics | null>(null);
  readonly statsLoading = signal(false);
  private statsSub?: Subscription;

  readonly busyId = signal<number | null>(null);

  /** Form dialog state. `formOpen` toggles the modal; `editId` ≠ null ⇒ edit. */
  readonly formOpen = signal(false);
  readonly editId = signal<number | null>(null);

  /** The exact query the table shows (tab filter + search + paging). */
  private readonly query = computed<ContractListQuery>(() => ({
    pageIndex: this.pageIndex(),
    pageSize: this.pageSize(),
    search: this.search() || undefined,
    salesPersonId: this.salesPersonId() ?? undefined,
    ...contractTabFilter(this.activeTab()),
  }));

  /** KPI tiles; `null` renders as a placeholder until statistics load. */
  readonly kpis = computed(() => {
    const s = this.stats();
    return {
      total: s?.totalContracts ?? null,
      active: s?.activeContracts ?? null,
      expiring: s?.expiringSoonContracts ?? null,
      expired: s?.expiredContracts ?? null,
      cancelled: s?.cancelledContracts ?? null,
    };
  });

  private readonly pageRequests$ = new Subject<{ query: ContractListQuery; force: boolean }>();
  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.pageRequests$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap(({ query, force }) =>
          this.service.list(query, force).pipe(
            map((page): PageLoad => ({ ok: true, page })),
            catchError(() => of<PageLoad>({ ok: false })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyPage(result));

    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.search.set(term);
        this.pageIndex.set(1);
        this.loadPage();
      });
  }

  ngOnInit(): void {
    this.reload();
    if (this.isAdmin()) {
      this.service.salesTeam().subscribe({
        next: (team) => this.salesTeam.set([...team].sort((a, b) => a.fullName.localeCompare(b.fullName))),
        error: () => this.salesTeam.set([]),
      });
    }
  }

  /** Statistics + current page (initial load, refresh, after mutations). */
  reload(force = false): void {
    this.loadStats(force);
    this.loadPage(force);
  }

  tabCount(tab: ContractTab): number | null {
    return contractTabCount(tab, this.stats());
  }

  private loadPage(force = false): void {
    this.pageRequests$.next({ query: this.query(), force });
  }

  /** KPI + tab numbers: the statistics endpoint, or per-rep counts when filtered. */
  private loadStats(force = false): void {
    const rep = this.salesPersonId();
    this.statsLoading.set(true);
    this.statsSub?.unsubscribe();
    const source = rep
      ? this.service.statisticsForSalesPerson(rep, force)
      : this.service.statistics(force);
    this.statsSub = source.subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.statsLoading.set(false);
      },
      // Keep the last known numbers; the table still works without them.
      error: () => this.statsLoading.set(false),
    });
  }

  private applyPage(result: PageLoad): void {
    if (!result.ok) {
      this.loading.set(false);
      this.loadError.set(this.t('sales.contractsMgmt.loadFailed'));
      return;
    }
    const { page } = result;
    // Past the end (e.g. the only row of the last page was deleted): step
    // back to the real last page instead of showing an empty table.
    const lastPage = Math.max(1, Math.ceil(page.count / this.pageSize()));
    if (page.data.length === 0 && this.pageIndex() > lastPage) {
      this.pageIndex.set(lastPage);
      this.loadPage(true);
      return;
    }
    this.rows.set(page.data);
    this.totalCount.set(page.count);
    this.loading.set(false);
  }

  // ─────────── filters / paging ───────────

  setTab(tab: ContractTab): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.pageIndex.set(1);
    this.loadPage();
  }

  onSearch(value: string): void {
    this.searchInput$.next(value.trim());
  }

  /** Admin: show one sales rep's contracts — cards, tabs and table follow. */
  onSalesPersonChange(userId: string | null): void {
    const next = userId || null;
    if (next === this.salesPersonId()) return;
    this.salesPersonId.set(next);
    this.pageIndex.set(1);
    this.stats.set(null);
    this.reload();
  }

  onPageChange(page: number): void {
    if (page === this.pageIndex()) return;
    this.pageIndex.set(page);
    this.loadPage();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Math.min(Math.max(1, size), CONTRACTS_MAX_PAGE_SIZE));
    this.pageIndex.set(1);
    this.loadPage();
  }

  // ─────────── create / edit ───────────

  openCreate(): void {
    this.editId.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: ContractListItem): void {
    if (this.busyId() === row.id) return;
    this.editId.set(row.id);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editId.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.reload(true);
  }

  /** Opens the printable One System sale-contract document (its own route). */
  openContract(row: ContractListItem): void {
    this.router.navigate(['/sale-contract', row.id]);
  }

  async confirmDelete(row: ContractListItem): Promise<void> {
    if (this.busyId() === row.id) return;
    const ok = await this.dialog.confirm({
      title: this.t('sales.contractsMgmt.deleteDialog.title'),
      message: this.t('sales.contractsMgmt.deleteDialog.message'),
      confirmText: this.t('sales.contractsMgmt.deleteDialog.confirm'),
      cancelText: this.t('sales.contractsMgmt.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.service.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('sales.contractsMgmt.messages.deleted'));
        this.reload(true);
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── row helpers ───────────

  /** Days left; null for open-ended contracts. */
  daysRemaining(row: ContractListItem): number | null {
    return daysUntilEnd(row.endDate);
  }

  isExpiringSoon(row: ContractListItem): boolean {
    return contractLifecycle(row) === 'expiring';
  }

  /** Badge reflects the effective state (an "Active" contract past its end date shows as expired). */
  statusBadgeClass(row: ContractListItem): string {
    return BADGES[contractLifecycle(row)];
  }

  statusKey(row: ContractListItem): string {
    return `sales.contractsMgmt.status.${LABELS[contractLifecycle(row)]}`;
  }

  /** Whole-number KPI; '—' while statistics are loading / unavailable. */
  formatCount(value: number | null): string {
    if (value == null) return '—';
    return value.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) return '0';
    return value.toLocaleString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { maximumFractionDigits: 2 },
    );
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  // ─────────── export / print ───────────

  /** Days-left label mirroring the table cell (expired ⇒ localized word). */
  daysLeftLabel(r: ContractListItem): string {
    const days = this.daysRemaining(r);
    if (days === null) return '—';
    if (days < 0) return this.t('sales.contractsMgmt.expired');
    return `${days} ${this.t('sales.contractsMgmt.day')}`;
  }

  get exportColumns(): ExportColumn<ContractListItem>[] {
    return [
      { header: this.t('sales.contractsMgmt.table.number'), value: (r) => r.id },
      { header: this.t('sales.contractsMgmt.table.customer'), value: (r) => r.customerName },
      { header: this.t('customers.details.company'), value: (r) => r.companyName },
      { header: this.t('customers.table.phone'), value: (r) => r.phone },
      { header: this.t('sales.contractsMgmt.form.address'), value: (r) => r.address },
      { header: this.t('sales.contractsMgmt.table.contractTitle'), value: (r) => r.title },
      { header: this.t('sales.contractsMgmt.table.status'), value: (r) => this.t(this.statusKey(r)) },
      { header: this.t('sales.contractsMgmt.table.startDate'), value: (r) => this.formatDate(r.startDate) },
      { header: this.t('sales.contractsMgmt.table.endDate'), value: (r) => this.formatDate(r.endDate) },
      { header: this.t('sales.contractsMgmt.table.createdAt'), value: (r) => this.formatDate(r.createdAt) },
      {
        header: this.t('sales.contractsMgmt.table.createdByName'),
        value: (r) => r.createdByName || this.t('sales.contractsMgmt.table.noCreator'),
      },
      { header: this.t('sales.contractsMgmt.table.daysLeft'), value: (r) => this.daysLeftLabel(r), align: 'center' },
      { header: this.t('sales.contractsMgmt.table.value'), value: (r) => this.formatMoney(r.price), align: 'end' },
    ];
  }

  /** Every contract matching the current tab + search, fetched 100 at a time. */
  readonly fetchAllRows = (): Promise<ContractListItem[]> => {
    const { pageIndex: _page, pageSize: _size, ...filters } = this.query();
    return firstValueFrom(this.service.listAllMatching(filters));
  };

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
