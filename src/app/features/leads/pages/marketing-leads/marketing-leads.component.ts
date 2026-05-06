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
import { Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  CustomerListItem,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';
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
  readonly assignDialog = signal<{ customerId: number; customerName: string } | null>(null);
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
    this.assignDialog.set({ customerId: row.id, customerName: row.fullName });
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
    return status;
  }

  statusBadgeClass(status: string | null): string {
    if (!status || status === 'none') return 'badge-status-unknown';
    const lower = status.toLowerCase();
    if (lower.includes('جديد') || lower === 'new') return 'badge-status-new';
    if (lower.includes('تفاوض') || lower === 'negotiating') return 'badge-status-negotiating';
    if (lower.includes('شراء') || lower === 'purchased') return 'badge-status-purchased';
    if (lower.includes('غير مهتم') || lower === 'not interested') return 'badge-status-lost';
    return 'badge-status-default';
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
