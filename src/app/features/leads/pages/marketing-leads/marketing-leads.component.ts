import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  CustomerListItem,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';
import { customerStatusBadgeClass, resolveCustomerStatus } from '../../utils/customer-status.util';
import { AssignSalesDialogComponent } from '../../components/assign-sales-dialog/assign-sales-dialog.component';
import { CustomerDetailsDialogComponent } from '../../components/customer-details-dialog/customer-details-dialog.component';
import { CustomerEditDialogComponent } from '../../components/customer-edit-dialog/customer-edit-dialog.component';

import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';

const DEFAULT_PAGE_SIZE = 10;

interface SourceItem {
  id: number;
  name: string;
}

@Component({
  selector: 'app-marketing-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LoadErrorComponent,
    PaginationComponent,
    StatCardComponent,
    AssignSalesDialogComponent,
    CustomerDetailsDialogComponent,
    CustomerEditDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-leads.component.html',
  styleUrl: './marketing-leads.component.scss',
})
export class MarketingLeadsComponent {
  private readonly router = inject(Router);
  private readonly customers = inject(CustomersService);
  private readonly channelSources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

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

  /** Per-row spinner key. */
  readonly busyId = signal<number | null>(null);

  readonly kpis = computed(() => ({
    total: this.count(),
    visible: this.rows().length,
    page: this.pageIndex(),
    pageSize: this.pageSize(),
  }));

  ngOnInit(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
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

  // ─────────── assign dialog ───────────

  openAssign(row: CustomerListItem): void {
    // If the list payload already carries the id, open immediately.
    if (row.salesPersonId !== undefined) {
      this.assignDialog.set({
        customerId: row.id,
        customerName: row.fullName,
        currentSalesPersonId: row.salesPersonId ?? null,
        currentSalesPersonName: row.salesPersonName ?? null,
      });
      return;
    }

    // Otherwise resolve the current rep id from the detail endpoint
    // (cached), so the dialog can pre-select and switch to "change" mode.
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
        // Fall back to plain assign-mode if details fail.
        this.assignDialog.set({
          customerId: row.id,
          customerName: row.fullName,
          currentSalesPersonId: null,
          currentSalesPersonName: row.salesPersonName ?? null,
        });
      },
    });
  }

  /** Hover/aria title for the assign action — switches based on assignment state. */
  assignTitle(row: CustomerListItem): string {
    return row.salesPersonName
      ? this.t('customers.table.reassign')
      : this.t('customers.table.assign');
  }

  onAssigned(): void {
    this.assignDialog.set(null);
    this.reload();
  }

  closeAssign(): void {
    this.assignDialog.set(null);
  }

  // ─────────── details dialog ───────────

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
  }

  // ─────────── edit dialog ───────────

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

  // ─────────── delete ───────────

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

  resolveStatus(status: string | null): string {
    if (!status || status === 'none') return this.t('customers.table.unknownStatus');
    return resolveCustomerStatus(status, this.language.lang(), status);
  }

  statusBadgeClass(status: string | null): string {
    if (!status) return 'badge-status-unknown';
    return customerStatusBadgeClass(status);
  }

  /** Localized name for a status row coming from `Customers/statuses` (always Arabic). */
  localizeStatusName(name: string): string {
    return resolveCustomerStatus(name, this.language.lang(), name);
  }

  formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(
        this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch {
      return dateStr;
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
