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
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  CustomerListItem,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { CustomerDetailsDialogComponent } from '../../components/customer-details-dialog/customer-details-dialog.component';
import { CustomersService } from '../../services/customers.service';

const DEFAULT_PAGE_SIZE = 10;

interface SourceItem {
  id: number;
  name: string;
}

/**
 * Sales view of customers.
 *
 * Backed by `GET /Customers/getSalesCustomers` — the backend applies its
 * own role-based filter:
 *   - Sales: only customers assigned to the caller
 *   - Admin: every customer assigned to any sales rep
 *
 * The page itself is read-only; mutations (assignment, lead creation) stay
 * in the marketing flow. The details modal is reused from the marketing
 * page so the two surfaces share the same customer record view.
 */
@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PageHeaderComponent,
    PaginationComponent,
    StatCardComponent,
    CustomerDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-leads.component.html',
  styleUrl: './sales-leads.component.scss',
})
export class SalesLeadsComponent implements OnInit, OnDestroy {
  private readonly customers = inject(CustomersService);
  private readonly channelSources = inject(ChannelSourcesService);
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
  readonly detailsDialog = signal<number | null>(null);

  /** True when the current user is an Admin. Drives copy + headers. */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** KPI summary derived from the current page. */
  readonly kpis = computed(() => {
    const list = this.rows();
    const matches = (target: string) =>
      list.filter((row) => (row.status ?? '').trim().toLowerCase() === target).length;

    return {
      total: this.count(),
      newCount: matches('new'),
      interested: matches('interested'),
      inSupport: matches('in support'),
    };
  });

  /** Empty-state copy switches based on role. */
  readonly emptyMessageKey = computed(() =>
    this.isAdmin() ? 'customers.sales.emptyAdmin' : 'customers.sales.empty',
  );

  readonly subtitleKey = computed(() =>
    this.isAdmin()
      ? 'customers.sales.subtitleAdmin'
      : 'customers.sales.subtitleSales',
  );

  readonly welcomeSubtitleKey = computed(() =>
    this.isAdmin()
      ? 'customers.sales.welcomeSubtitleAdmin'
      : 'customers.sales.welcomeSubtitleSales',
  );

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
      .listForSales({
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

  // ─────────── details dialog ───────────

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
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
    if (lower.includes('شراء') || lower === 'purchased' || lower === 'buyer') return 'badge-status-purchased';
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

  trackById = (_: number, r: CustomerListItem) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
