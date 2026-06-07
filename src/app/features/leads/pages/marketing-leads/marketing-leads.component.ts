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
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CustomerListItem,
  CustomerNoteResponse,
  CustomerStatus,
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
    AssignSalesDialogComponent,
    CustomerActivitiesDialogComponent,
    CustomerDetailsDialogComponent,
    CustomerEditDialogComponent,
    CustomerNoteDialogComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
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
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.customers
      .list({
        PageIndex: this.pageIndex(),
        PageSize: this.pageSize(),
        Search: this.searchSignal().trim() || undefined,
        CustomerStatusId: this.selectedStatusId() ?? undefined,
        SourceId: this.selectedSourceId() ?? undefined,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('customers.messages.loadFailed'));
        },
      });
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

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
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

    if (!row.salesPersonName) {
      this.assignDialog.set({
        customerId: row.id,
        customerName: row.fullName,
        currentSalesPersonId: null,
        currentSalesPersonName: null,
      });
      return;
    }

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
    this.rows.update((list) =>
      list.map((row) =>
        row.id === res.customerId
          ? {
              ...row,
              noteMarketing: res.noteMarketing,
              noteSales: res.noteSales,
              noteSupport: res.noteSupport,
            }
          : row,
      ),
    );
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

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(
        this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch {
      return dateStr;
    }
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
        header: this.t('customers.table.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
    ];
  }

  /** Pulls every page using the active filters (for "all pages" export/print). */
  readonly fetchAllRows = async (): Promise<CustomerListItem[]> => {
    const page = await firstValueFrom(
      this.customers.list({
        PageIndex: 1,
        PageSize: this.count() || this.pageSize(),
        Search: this.searchSignal().trim() || undefined,
        CustomerStatusId: this.selectedStatusId() ?? undefined,
        SourceId: this.selectedSourceId() ?? undefined,
      }),
    );
    return page.data ?? [];
  };

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
