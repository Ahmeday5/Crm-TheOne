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
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  CustomerFollowUpResponse,
  CustomerListItem,
  CustomerNoteResponse,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChangeStatusDialogComponent } from '../../../leads/components/change-status-dialog/change-status-dialog.component';
import {
  CustomerActionsConfig,
  CustomerActionsMenuComponent,
} from '../../../leads/components/customer-actions-menu/customer-actions-menu.component';
import { CustomerDetailsDialogComponent } from '../../../leads/components/customer-details-dialog/customer-details-dialog.component';
import { CustomerNoteDialogComponent } from '../../../leads/components/customer-note-dialog/customer-note-dialog.component';
import { CustomerNotesCellComponent } from '../../../leads/components/customer-notes-cell/customer-notes-cell.component';
import { FollowUpDialogComponent } from '../../../leads/components/follow-up-dialog/follow-up-dialog.component';
import { CustomersService } from '../../../leads/services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../../leads/utils/customer-status.util';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';

const DEFAULT_PAGE_SIZE = 10;

interface SourceItem {
  id: number;
  name: string;
}

/**
 * Support-team customer queue.
 *
 * Visual language is shared with `SalesLeadsComponent` and
 * `MarketingLeadsComponent` via `<app-customer-notes-cell>`,
 * `<app-customer-actions-menu>`, and `_customers-table.scss`. This page
 * sticks to a support-flavoured action surface — no `assignSupport` / no
 * `delete`.
 */
@Component({
  selector: 'app-designated-clients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PageHeaderComponent,
    PaginationComponent,
    StatCardComponent,
    LoadErrorComponent,
    CustomerDetailsDialogComponent,
    ChangeStatusDialogComponent,
    FollowUpDialogComponent,
    CustomerNoteDialogComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designated-clients.component.html',
  styleUrl: './designated-clients.component.scss',
})
export class DesignatedClientsComponent implements OnInit, OnDestroy {
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
  readonly changeStatusDialog = signal<CustomerListItem | null>(null);
  readonly followUpDialog = signal<CustomerListItem | null>(null);
  readonly noteDialog = signal<CustomerListItem | null>(null);

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  readonly subtitleKey = computed(() =>
    this.isAdmin() ? 'customers.support.subtitleAdmin' : 'customers.support.subtitle',
  );

  readonly emptyMessageKey = computed(() =>
    this.isAdmin() ? 'customers.support.emptyAdmin' : 'customers.support.empty',
  );

  readonly welcomeSubtitleKey = computed(() =>
    this.isAdmin()
      ? 'customers.support.welcomeSubtitleAdmin'
      : 'customers.support.welcomeSubtitle',
  );

  /**
   * Support row toolbar:
   *   - inline: view + note + tel/wa
   *   - dropdown: change-status, follow-up
   * No assignSupport / assignSales / delete — those are owned by sales/marketing.
   */
  readonly actionsConfig: CustomerActionsConfig = {
    view: true,
    note: true,
    changeStatus: true,
    followUp: true,
  };

  readonly kpis = computed(() => {
    const list = this.rows();
    return {
      total: this.count(),
      assigned: list.length,
      pendingFollowUp: list.filter((r) => !!r.nextFollowUpDate).length,
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
      .listForSupport({
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

  // ─────────── dialogs ───────────

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
  }

  openChangeStatus(row: CustomerListItem): void {
    this.changeStatusDialog.set(row);
  }

  closeChangeStatus(): void {
    this.changeStatusDialog.set(null);
  }

  onStatusChanged(_res: CustomerFollowUpResponse): void {
    this.closeChangeStatus();
    this.reload();
  }

  openFollowUp(row: CustomerListItem): void {
    this.followUpDialog.set(row);
  }

  closeFollowUp(): void {
    this.followUpDialog.set(null);
  }

  onFollowUpUpdated(res: CustomerFollowUpResponse): void {
    this.rows.update((list) =>
      list.map((row) =>
        row.id === res.id
          ? {
              ...row,
              lastFollowUpDate: res.lastFollowUpDate,
              nextFollowUpDate: res.nextFollowUpDate,
            }
          : row,
      ),
    );
    this.closeFollowUp();
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

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
