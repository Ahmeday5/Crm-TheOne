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
import { firstValueFrom } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CustomerDropdownItem,
  PriceQuotationListItem,
} from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PriceOfferFormDialogComponent } from '../../components/price-offer-form-dialog/price-offer-form-dialog.component';
import { PriceQuotationsService } from '../../services/price-quotations.service';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Price-quotation list.
 *
 * Server-paged via `GET /PriceQuotations`, with an optional customer filter
 * (the same dropdown the form uses). Each row exposes three actions:
 *   - contract  → opens the printable One System quotation document
 *   - edit      → opens the form pre-filled
 *   - delete    → confirm + remove
 */
@Component({
  selector: 'app-price-offers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    MoneyPipe,
    EmptyStateComponent,
    LoadErrorComponent,
    StatCardComponent,
    PaginationComponent,
    TableToolsComponent,
    PriceOfferFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-offers.component.html',
  styleUrl: './price-offers.component.scss',
})
export class PriceOffersComponent implements OnInit {
  private readonly service = inject(PriceQuotationsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  readonly rows = signal<PriceQuotationListItem[]>([]);
  readonly customers = signal<CustomerDropdownItem[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly selectedCustomerId = signal<number | null>(null);

  /** Form dialog state. `formOpen` toggles the modal; `editId` ≠ null ⇒ edit. */
  readonly formOpen = signal(false);
  readonly editId = signal<number | null>(null);

  /** KPI summary derived from the current page. */
  readonly kpis = computed(() => {
    const list = this.rows();
    return {
      count: this.totalCount(),
      totalValue: list.reduce((s, r) => s + (r.netTotal ?? 0), 0),
      totalDiscount: list.reduce((s, r) => s + (r.discount ?? 0), 0),
    };
  });

  ngOnInit(): void {
    this.loadCustomers();
    this.reload();
  }

  // ─────────── data ───────────

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service
      .list(
        {
          PageIndex: this.pageIndex(),
          PageSize: this.pageSize(),
          CustomerId: this.selectedCustomerId() ?? undefined,
        },
        force,
      )
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.totalCount.set(page.totalCount ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('sales.priceOffers.loadFailed'));
        },
      });
  }

  private loadCustomers(): void {
    this.service.customersDropdown().subscribe({
      next: (rows) => this.customers.set(rows ?? []),
    });
  }

  // ─────────── filters / pagination ───────────

  onCustomerFilterChange(value: string): void {
    this.selectedCustomerId.set(value ? Number(value) : null);
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

  // ─────────── row actions ───────────

  openCreate(): void {
    this.editId.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: PriceQuotationListItem): void {
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
  }

  /** Opens the printable One System quotation contract (its own route). */
  openContract(row: PriceQuotationListItem): void {
    this.router.navigate(['/price-offer-contract', row.id]);
  }

  async confirmDelete(row: PriceQuotationListItem): Promise<void> {
    if (this.busyId() === row.id) return;
    const ok = await this.dialog.confirm({
      title: this.t('sales.priceOffers.deleteDialog.title'),
      message: this.t('sales.priceOffers.deleteDialog.message'),
      confirmText: this.t('sales.priceOffers.deleteDialog.confirm'),
      cancelText: this.t('sales.priceOffers.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.service.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('sales.priceOffers.messages.deleted'));
        // Step back a page if we just removed the last row on it.
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

  formatMoney(value: number | null | undefined): string {
    if (value == null) return '0';
    return value.toLocaleString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { maximumFractionDigits: 2 },
    );
  }

  // ─────────── export / print ───────────

  get exportColumns(): ExportColumn<PriceQuotationListItem>[] {
    return [
      { header: this.t('sales.priceOffers.table.number'), value: (r) => r.id },
      {
        header: this.t('sales.priceOffers.table.customer'),
        value: (r) => r.customerName,
      },
      { header: this.t('customers.details.company'), value: (r) => r.campanyName },
      {
        header: this.t('sales.priceOffers.table.items'),
        value: (r) => r.itemsCount,
        align: 'center',
      },
      {
        header: this.t('sales.priceOffers.table.subTotal'),
        value: (r) => this.formatMoney(r.subTotal),
        align: 'end',
      },
      {
        header: this.t('sales.priceOffers.table.discount'),
        value: (r) => this.formatMoney(r.discount),
        align: 'end',
      },
      {
        header: this.t('sales.priceOffers.table.netTotal'),
        value: (r) => this.formatMoney(r.netTotal),
        align: 'end',
      },
    ];
  }

  readonly fetchAllRows = async (): Promise<PriceQuotationListItem[]> => {
    const page = await firstValueFrom(
      this.service.list({
        PageIndex: 1,
        PageSize: this.totalCount() || this.pageSize(),
        CustomerId: this.selectedCustomerId() ?? undefined,
      }),
    );
    return page.data ?? [];
  };

  trackById = (_: number, r: PriceQuotationListItem) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
