import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
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
import { ContractListItem } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractFormDialogComponent } from '../../components/contract-form-dialog/contract-form-dialog.component';
import { ContractsService } from '../../services/contracts.service';
import {
  ContractLifecycle,
  contractLifecycle,
  countContracts,
  daysUntilEnd,
} from '../../utils/contract-lifecycle.util';

type ContractTab = 'all' | 'active' | 'expiring' | 'expired' | 'cancelled';

const DEFAULT_PAGE_SIZE = 10;

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

/**
 * Contracts management.
 *
 * The API has no status filter, so the whole portfolio is loaded once and
 * KPI tiles, tab badges, the table and pagination are all derived from that
 * single list through `contractLifecycle()` — the numbers can't disagree.
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

  /** Every contract — tabs, counts, KPIs and pagination all derive from it. */
  readonly rows = signal<ContractListItem[]>([]);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly search = signal('');
  readonly activeTab = signal<ContractTab>('all');

  /** Form dialog state. `formOpen` toggles the modal; `editId` ≠ null ⇒ edit. */
  readonly formOpen = signal(false);
  readonly editId = signal<number | null>(null);

  readonly tabs: ReadonlyArray<{ key: ContractTab; icon: string }> = [
    { key: 'all', icon: 'fa-solid fa-folder-open' },
    { key: 'active', icon: 'fa-solid fa-file-circle-check' },
    { key: 'expiring', icon: 'fa-solid fa-circle-exclamation' },
    { key: 'expired', icon: 'fa-solid fa-file-circle-xmark' },
    { key: 'cancelled', icon: 'fa-solid fa-ban' },
  ];

  /** Rows after the search filter (feeds the tab badges and the table). */
  private readonly searched = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((r) =>
      [r.customerName, r.companyName, r.phone, r.title, `cnt-${r.id}`]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  });

  /** Search + active tab, across ALL contracts. */
  readonly filteredRows = computed(() =>
    this.searched().filter((r) => this.matchesTab(r, this.activeTab())),
  );

  /** The current page of `filteredRows`. */
  readonly visibleRows = computed(() => {
    const start = (this.pageIndex() - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  /** Tab badges — same data as the table, so a badge always matches its tab. */
  readonly tabCounts = computed(() => countContracts(this.searched()));

  /** KPI tiles — the whole portfolio (unaffected by search). */
  readonly stats = computed(() => {
    const c = countContracts(this.rows());
    return { total: c.all, active: c.active, expiring: c.expiring, expired: c.expired, cancelled: c.cancelled };
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.listAll(force).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.clampPage();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('sales.contractsMgmt.loadFailed'));
      },
    });
  }

  // ─────────── filters / paging ───────────

  setTab(tab: ContractTab): void {
    this.activeTab.set(tab);
    this.pageIndex.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(1);
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
  }

  /** Keep the page in range after a delete. */
  private clampPage(): void {
    const pages = Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()));
    if (this.pageIndex() > pages) this.pageIndex.set(pages);
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

  private matchesTab(row: ContractListItem, tab: ContractTab): boolean {
    if (tab === 'all') return true;
    const state = contractLifecycle(row);
    // "Active" includes the ones expiring soon — they are still active.
    if (tab === 'active') return state === 'active' || state === 'expiring';
    return state === tab;
  }

  /** Badge reflects the effective state (an "Active" contract past its end date shows as expired). */
  statusBadgeClass(row: ContractListItem): string {
    return BADGES[contractLifecycle(row)];
  }

  statusKey(row: ContractListItem): string {
    return `sales.contractsMgmt.status.${LABELS[contractLifecycle(row)]}`;
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

  trackById = (_: number, r: ContractListItem) => r.id;

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

  /** Current page = the rows visible after search + active tab. */
  get visibleExportRows(): ContractListItem[] {
    return this.visibleRows();
  }

  /** Every matching contract (all pages) — already loaded, no extra request. */
  readonly fetchAllRows = async (): Promise<ContractListItem[]> => this.filteredRows();

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
