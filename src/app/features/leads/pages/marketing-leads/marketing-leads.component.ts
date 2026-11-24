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
import { Router } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import {
  isDateRangeActive,
  toDateRangeParams,
} from '../../../../core/utils/date-range.util';
import { CreatedAtComponent } from '../../../../shared/components/created-at/created-at.component';
import { CustomerDateRangeFilterComponent } from '../../../../shared/components/customer-date-range-filter/customer-date-range-filter.component';
import { DateRangeChipComponent } from '../../../../shared/components/customer-date-range-filter/date-range-chip.component';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { formatCairoDate } from '../../../../shared/pipes/cairo-date.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CustomerDateFilter,
  CustomerListItem,
  CustomerListQuery,
  CustomerNoteResponse,
  CustomerStatus,
  SalesPerson,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { AssignSalesDialogComponent } from '../../components/assign-sales-dialog/assign-sales-dialog.component';
import { CustomerActivitiesDialogComponent } from '../../components/customer-activities-dialog/customer-activities-dialog.component';
import {
  CustomerActionsConfig,
  CustomerActionsMenuComponent,
} from '../../components/customer-actions-menu/customer-actions-menu.component';
import { CustomerDetailsDialogComponent } from '../../components/customer-details-dialog/customer-details-dialog.component';
import { CustomerEditDialogComponent } from '../../components/customer-edit-dialog/customer-edit-dialog.component';
import { CustomerNoteDialogComponent } from '../../components/customer-note-dialog/customer-note-dialog.component';
import { CustomerNotesCellComponent } from '../../components/customer-notes-cell/customer-notes-cell.component';
import { CustomersService } from '../../services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../utils/customer-status.util';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import {
  UNASSIGNED_SALES,
  fetchAllPages,
  lastPage,
  matchesSalesPerson,
  pageSlice,
} from '../../utils/sales-person-filter.util';

const DEFAULT_PAGE_SIZE = 10;

interface SourceItem {
  id: number;
  name: string;
}

/**
 * Marketing leads queue.
 *
 * Shares the table chrome / notes cell / actions menu with the sales and
 * support pages. Marketing-specific actions live inside the kebab menu:
 * edit, assign-sales, delete.
 */
@Component({
  selector: 'app-marketing-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LoadErrorComponent,
    EmptyStateComponent,
    PaginationComponent,
    StatCardComponent,
    TableToolsComponent,
    TipDirective,
    AssignSalesDialogComponent,
    CustomerActivitiesDialogComponent,
    CustomerDetailsDialogComponent,
    CustomerEditDialogComponent,
    CustomerNoteDialogComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
    ClampTextDirective,
    ResponsiveTableDirective,
    CustomerDateRangeFilterComponent,
    DateRangeChipComponent,
    CreatedAtComponent,
    TableSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-leads.component.html',
  styleUrl: './marketing-leads.component.scss',
})
export class MarketingLeadsComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly customers = inject(CustomersService);
  private readonly channelSources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  // ─────────── search / filter ───────────
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly searchSignal = signal('');
  readonly selectedStatusId = signal<number | null>(null);
  readonly selectedSourceId = signal<number | null>(null);
  /** "Date added" range (`From` / `To`). */
  readonly dateFilter = signal<CustomerDateFilter>({});

  /** Sales-rep filter — `UNASSIGNED_SALES` = not assigned yet. Applied client-side, see the util. */
  readonly selectedSalesPersonId = signal<string | null>(null);
  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly unassignedSales = UNASSIGNED_SALES;
  /** Every row matching the server filters + the rep, while a rep is selected. */
  private repRows: CustomerListItem[] | null = null;
  /** Drops answers of superseded loads (fast filter switching). */
  private loadSeq = 0;

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchSignal() ||
      this.selectedStatusId() !== null ||
      this.selectedSourceId() !== null ||
      this.selectedSalesPersonId() !== null ||
      isDateRangeActive(this.dateFilter()),
  );

  // ─────────── data ───────────
  readonly rows = signal<CustomerListItem[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ─────────── dropdown data ───────────
  readonly statuses = signal<CustomerStatus[]>([]);
  readonly sources = signal<SourceItem[]>([]);

  // ─────────── dialogs ───────────
  readonly assignDialog = signal<{
    customerId: number;
    customerName: string;
    currentSalesPersonId: string | null;
    currentSalesPersonName: string | null;
  } | null>(null);
  readonly detailsDialog = signal<number | null>(null);
  readonly editDialog = signal<number | null>(null);
  readonly activitiesDialog = signal<CustomerListItem | null>(null);
  readonly noteDialog = signal<CustomerListItem | null>(null);

  /** Per-row spinner key. */
  readonly busyId = signal<number | null>(null);

  /**
   * Marketing row toolbar — keeps the high-frequency actions inline and
   * the destructive / chunky ones (edit, assign-sales, delete) in the
   * kebab menu.
   */
  readonly actionsConfig: CustomerActionsConfig = {
    view: true,
    note: true,
    edit: true,
    assignSales: true,
    activities: true,
    // Marketing users lack the delete permission on the backend — don't show
    // an action that would only ever 403.
    delete: this.auth.currentRole() === 'Admin',
  };

  readonly kpis = computed(() => {
    const list = this.rows();
    return {
      total: this.count(),
      newLeads: list.filter((r) => (r.status ?? '').trim().toLowerCase() === 'new').length,
      transferred: list.filter((r) => !!r.isMarketingToSales).length,
      withNotes: list.filter(
        (r) =>
          !!(r.noteMarketing?.trim()) ||
          !!(r.noteSales?.trim()) ||
          !!(r.noteSupport?.trim()),
      ).length,
    };
  });

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });

    this.loadFilters();
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  private loadFilters(): void {
    this.customers.statuses().subscribe({
      next: (items) => this.statuses.set(items),
    });
    this.channelSources.list().subscribe({
      next: (items: SourceItem[]) => this.sources.set(items),
    });
    this.customers.salesTeam().subscribe({
      next: (team) => this.salesTeam.set([...(team ?? [])].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ar'))),
      error: () => undefined,
    });
  }

  /** The list query for the current server-side filters (table, export). Empty filters stay `undefined`. */
  private listQuery(pageIndex: number, pageSize: number): CustomerListQuery {
    return {
      PageIndex: pageIndex,
      PageSize: pageSize,
      Search: this.searchSignal().trim() || undefined,
      CustomerStatusId: this.selectedStatusId() ?? undefined,
      SourceId: this.selectedSourceId() ?? undefined,
      ...toDateRangeParams(this.dateFilter()),
    };
  }

  reload(force = false): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    this.repRows = null;

    const rep = this.selectedSalesPersonId();
    if (rep) {
      fetchAllPages((pageIndex, pageSize) => this.customers.list(this.listQuery(pageIndex, pageSize), force))
        .then((all) => {
          if (seq !== this.loadSeq) return;
          this.repRows = all.filter((r) => matchesSalesPerson(r, rep, this.salesTeam()));
          this.showRepPage();
          this.loading.set(false);
        })
        .catch(() => {
          if (seq !== this.loadSeq) return;
          this.loading.set(false);
          this.loadError.set(this.t('customers.messages.loadFailed'));
        });
      return;
    }

    this.customers.list(this.listQuery(this.pageIndex(), this.pageSize()), force).subscribe({
      next: (page) => {
        if (seq !== this.loadSeq) return;
        this.rows.set(page.data ?? []);
        this.count.set(page.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        if (seq !== this.loadSeq) return;
        this.loading.set(false);
        this.loadError.set(this.t('customers.messages.loadFailed'));
      },
    });
  }

  /** Pages the rep-filtered set locally (no refetch). */
  private showRepPage(): void {
    const all = this.repRows ?? [];
    const last = lastPage(all.length, this.pageSize());
    if (this.pageIndex() > last) this.pageIndex.set(last);
    this.count.set(all.length);
    this.rows.set(pageSlice(all, this.pageIndex(), this.pageSize()));
  }

  // ─────────── search / filters / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onStatusChange(id: string): void {
    this.selectedStatusId.set(id ? Number(id) : null);
    this.pageIndex.set(1);
    this.reload();
  }

  onSourceChange(id: string): void {
    this.selectedSourceId.set(id ? Number(id) : null);
    this.pageIndex.set(1);
    this.reload();
  }

  /** Date-added range changed (picker, preset or chip): back to page 1. */
  onDateFilterChange(range: CustomerDateFilter): void {
    this.dateFilter.set(range);
    this.pageIndex.set(1);
    this.reload();
  }

  onSalesPersonChange(id: string): void {
    this.selectedSalesPersonId.set(id || null);
    this.pageIndex.set(1);
    this.reload();
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    if (this.repRows) this.showRepPage();
    else this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    if (this.repRows) this.showRepPage();
    else this.reload();
  }

  // ─────────── navigation ───────────

  goToAddLead(): void {
    this.router.navigate(['/leads/add-leadCustomer']);
  }

  // ─────────── dialogs ───────────

  openAssign(row: CustomerListItem): void {
    if (row.salesPersonId !== undefined) {
      this.assignDialog.set({
        customerId: row.id,
        customerName: row.fullName,
        currentSalesPersonId: row.salesPersonId ?? null,
        currentSalesPersonName: row.salesPersonName ?? null,
      });
      return;
    }

    // The lead list carries no `salesPersonId`, and its `salesPersonName` can
    // be empty while the customer IS assigned (e.g. buyers) — so always ask
    // the details endpoint who the current rep is. Otherwise the dialog opens
    // in "new assignment" mode and the backend rejects the real rep with
    // "Customer is already assigned to this sales person".
    this.busyId.set(row.id);
    this.customers.getById(row.id).subscribe({
      next: (detail) => {
        this.busyId.set(null);
        this.assignDialog.set({
          customerId: row.id,
          customerName: row.fullName,
          currentSalesPersonId: detail.salesPersonId ?? null,
          currentSalesPersonName: detail.salesPersonName ?? row.salesPersonName ?? null,
        });
      },
      error: () => {
        this.busyId.set(null);
        this.assignDialog.set({
          customerId: row.id,
          customerName: row.fullName,
          currentSalesPersonId: null,
          currentSalesPersonName: row.salesPersonName ?? null,
        });
      },
    });
  }

  onAssigned(): void {
    this.assignDialog.set(null);
    this.reload();
  }

  closeAssign(): void {
    this.assignDialog.set(null);
  }

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
  }

  openEdit(row: CustomerListItem): void {
    this.editDialog.set(row.id);
  }

  onEdited(): void {
    this.editDialog.set(null);
    this.reload();
  }

  closeEdit(): void {
    this.editDialog.set(null);
  }

  openActivities(row: CustomerListItem): void {
    this.activitiesDialog.set(row);
  }

  closeActivities(): void {
    this.activitiesDialog.set(null);
  }

  openNote(row: CustomerListItem): void {
    this.noteDialog.set(row);
  }

  closeNote(): void {
    this.noteDialog.set(null);
  }

  onNoteSaved(res: CustomerNoteResponse): void {
    const patch = (list: CustomerListItem[]) =>
      list.map((row) =>
        row.id === res.customerId
          ? {
              ...row,
              noteMarketing: res.noteMarketing,
              noteSales: res.noteSales,
              noteSupport: res.noteSupport,
            }
          : row,
      );
    this.rows.update(patch);
    if (this.repRows) this.repRows = patch(this.repRows);
    this.closeNote();
  }

  async confirmDelete(row: CustomerListItem): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('customers.deleteDialog.title'),
      message: this.t('customers.deleteDialog.message'),
      confirmText: this.t('customers.deleteDialog.confirm'),
      cancelText: this.t('customers.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.customers.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('customers.messages.deleted'));
        if (this.rows().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.status === 409) {
          this.toast.error(this.t('customers.messages.deleteFkError'));
        } else if (err?.message) {
          this.toast.error(err.message);
        }
      },
    });
  }

  // ─────────── helpers ───────────

  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  resolveStatus(status: string | null): string {
    if (!status || status === 'none') return this.t('customers.table.unknownStatus');
    return resolveCustomerStatus(status, this.language.lang(), status);
  }

  statusBadgeClass(status: string | null): string {
    if (!status) return 'badge-status-unknown';
    return customerStatusBadgeClass(status);
  }

  localizeStatusName(name: string): string {
    return resolveCustomerStatus(name, this.language.lang(), name);
  }

  /** Server timestamps are UTC without a `Z`; read as UTC, shown in Cairo time. */
  formatDate(dateStr: string | null | undefined): string {
    return formatCairoDate(dateStr, this.language.lang(), 'date');
  }

  trackById = (_: number, r: CustomerListItem) => r.id;

  // ─────────── export / print ───────────

  /** Column map shared by the Excel export and the printed report. */
  get exportColumns(): ExportColumn<CustomerListItem>[] {
    return [
      { header: this.t('customers.table.fullName'), value: (r) => r.fullName },
      { header: this.t('customers.table.phone'), value: (r) => r.phone },
      { header: this.t('customers.table.address'), value: (r) => r.address },
      { header: this.t('customers.table.source'), value: (r) => r.source },
      { header: this.t('customers.table.campaign'), value: (r) => r.campaignName },
      {
        header: this.t('customers.table.services'),
        value: (r) => (r.services ?? []).map((s) => s.name).join(', '),
      },
      {
        header: this.t('customers.table.status'),
        value: (r) => this.resolveStatus(r.status),
      },
      {
        header: this.t('customers.table.salesPerson'),
        value: (r) => r.salesPersonName,
      },
      {
        header: this.t('customers.details.noteMarketing'),
        value: (r) => r.noteMarketing || this.t('customers.details.notAvailable'),
      },
      {
        header: this.t('customers.details.noteSales'),
        value: (r) => r.noteSales || this.t('customers.details.notAvailable'),
      },
      {
        header: this.t('customers.details.noteSupport'),
        value: (r) => r.noteSupport || this.t('customers.details.notAvailable'),
      },
      {
        header: this.t('dateFilter.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
    ];
  }

  /** Pulls every page using the active filters (the server caps a page at 50). */
  readonly fetchAllRows = async (): Promise<CustomerListItem[]> => {
    if (this.repRows) return [...this.repRows];
    return fetchAllPages((pageIndex, pageSize) => this.customers.list(this.listQuery(pageIndex, pageSize)));
  };

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
