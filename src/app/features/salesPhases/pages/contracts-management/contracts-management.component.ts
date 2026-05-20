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
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  ContractListItem,
  ContractStatistics,
  ContractStatusCode,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractFormDialogComponent } from '../../components/contract-form-dialog/contract-form-dialog.component';
import { ContractsService } from '../../services/contracts.service';

type ContractTab = 'all' | 'active' | 'expiring' | 'expired' | 'cancelled';

const DEFAULT_PAGE_SIZE = 10;
/** A contract counts as "expiring soon" when it's active and ends within… */
const EXPIRING_WINDOW_DAYS = 90;

@Component({
  selector: 'app-contracts-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PageHeaderComponent,
    StatCardComponent,
    PaginationComponent,
    LoadErrorComponent,
    ContractFormDialogComponent,
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

  readonly rows = signal<ContractListItem[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  /** Server-side KPI summary (`GET /Contracts/ContractStatistics`). */
  readonly statistics = signal<ContractStatistics | null>(null);

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

  /** Rows after the search filter (used by both tab counts and the table). */
  private readonly searched = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((r) =>
      [r.customerName, r.companyName, r.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  });

  readonly visibleRows = computed(() =>
    this.searched().filter((r) => this.matchesTab(r, this.activeTab())),
  );

  readonly tabCounts = computed(() => {
    const list = this.searched();
    return {
      all: list.length,
      active: list.filter((r) => this.matchesTab(r, 'active')).length,
      expiring: list.filter((r) => this.matchesTab(r, 'expiring')).length,
      expired: list.filter((r) => this.matchesTab(r, 'expired')).length,
      cancelled: list.filter((r) => this.matchesTab(r, 'cancelled')).length,
    };
  });

  /**
   * KPI tiles. Total / active / expiring / expired come from the server-side
   * statistics endpoint; "cancelled" isn't in that payload so it's derived
   * from the loaded page as a best-effort indicator.
   */
  readonly stats = computed(() => {
    const s = this.statistics();
    const cancelled = this.rows().filter(
      (r) => r.status === ContractStatusCode.Cancelled,
    ).length;
    return {
      total: s?.totalContracts ?? this.totalCount(),
      active: s?.activeContracts ?? 0,
      expiring: s?.expiringSoonContracts ?? 0,
      expired: s?.expiredContracts ?? 0,
      cancelled,
    };
  });

  ngOnInit(): void {
    this.reload();
    this.loadStatistics();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service
      .list({ PageIndex: this.pageIndex(), PageSize: this.pageSize() })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.totalCount.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('sales.contractsMgmt.loadFailed'));
        },
      });
  }

  private loadStatistics(): void {
    this.service.statistics().subscribe({
      next: (s) => this.statistics.set(s),
    });
  }

  // ─────────── filters ───────────

  setTab(tab: ContractTab): void {
    this.activeTab.set(tab);
  }

  onSearch(value: string): void {
    this.search.set(value);
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
    this.reload();
    this.loadStatistics();
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
        if (this.rows().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
        this.loadStatistics();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── row helpers ───────────

  daysRemaining(row: ContractListItem): number {
    const end = new Date(row.endDate);
    if (Number.isNaN(end.getTime())) return 0;
    const ms = end.getTime() - Date.now();
    return Math.ceil(ms / 86_400_000);
  }

  isExpiringSoon(row: ContractListItem): boolean {
    if (row.status !== ContractStatusCode.Active) return false;
    const days = this.daysRemaining(row);
    return days > 0 && days <= EXPIRING_WINDOW_DAYS;
  }

  private matchesTab(row: ContractListItem, tab: ContractTab): boolean {
    switch (tab) {
      case 'all':
        return true;
      case 'active':
        return row.status === ContractStatusCode.Active;
      case 'expiring':
        return this.isExpiringSoon(row);
      case 'expired':
        return (
          row.status === ContractStatusCode.Expired || this.daysRemaining(row) < 0
        );
      case 'cancelled':
        return row.status === ContractStatusCode.Cancelled;
      default:
        return true;
    }
  }

  statusBadgeClass(row: ContractListItem): string {
    switch (row.status) {
      case ContractStatusCode.Active:
        return 'bg-success-subtle text-success';
      case ContractStatusCode.Expired:
        return 'bg-danger-subtle text-danger';
      case ContractStatusCode.Cancelled:
        return 'bg-secondary-subtle text-secondary';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  statusKey(row: ContractListItem): string {
    const code = row.status;
    const name =
      code === ContractStatusCode.Active
        ? 'active'
        : code === ContractStatusCode.Expired
          ? 'expired'
          : 'cancelled';
    return `sales.contractsMgmt.status.${name}`;
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

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
