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
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CustomerListItem,
  CustomerNoteResponse,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CustomerActionsConfig,
  CustomerActionsMenuComponent,
} from '../../../leads/components/customer-actions-menu/customer-actions-menu.component';
import { CustomerActivitiesDialogComponent } from '../../../leads/components/customer-activities-dialog/customer-activities-dialog.component';
import { CustomerDetailsDialogComponent } from '../../../leads/components/customer-details-dialog/customer-details-dialog.component';
import { CustomerNoteDialogComponent } from '../../../leads/components/customer-note-dialog/customer-note-dialog.component';
import { CustomerNotesCellComponent } from '../../../leads/components/customer-notes-cell/customer-notes-cell.component';
import { CustomersService } from '../../../leads/services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../../leads/utils/customer-status.util';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { ConsultationDialogComponent } from '../../components/consultation-dialog/consultation-dialog.component';

const DEFAULT_PAGE_SIZE = 10;

interface SourceItem {
  id: number;
  name: string;
}

/**
 * Support-team customer queue.
 *
 * The support agent's only action here is the **consultation** flow: review the
 * customer + the sales note, then either keep following up or hand the customer
 * back to a sales rep (`<app-consultation-dialog>`). Status changes, follow-ups
 * and note editing are owned by the sales/marketing surfaces — this page is
 * intentionally read-only beyond the consultation. Shares the customer-table
 * visual language via `<app-customer-notes-cell>` + `_customers-table.scss`.
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
    EmptyStateComponent,
    TableToolsComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
    CustomerActivitiesDialogComponent,
    CustomerDetailsDialogComponent,
    CustomerNoteDialogComponent,
    ConsultationDialogComponent,
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
  readonly consultDialog = signal<CustomerListItem | null>(null);
  readonly activitiesDialog = signal<CustomerListItem | null>(null);
  readonly detailsDialog = signal<number | null>(null);
  readonly noteDialog = signal<CustomerListItem | null>(null);

  /**
   * Row toolbar for the support queue: view details + edit-my-note inline, plus
   * the tel/WhatsApp anchors the menu derives from the phone. The dedicated
   * "Start consultation" CTA stays separate so it never gets buried.
   */
  readonly actionsConfig: CustomerActionsConfig = {
    view: true,
    note: true,
    activities: true,
  };

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

  readonly kpis = computed(() => {
    const list = this.rows();
    return {
      total: this.count(),
      consulted: list.filter((r) => r.isConsulted === true).length,
      pending: list.filter((r) => r.isConsulted !== true).length,
      withNotes: list.filter(
        (r) =>
          !!r.noteMarketing?.trim() ||
          !!r.noteSales?.trim() ||
          !!r.noteSupport?.trim(),
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

  // ─────────── consultation ───────────

  openConsult(row: CustomerListItem): void {
    this.consultDialog.set(row);
  }

  closeConsult(): void {
    this.consultDialog.set(null);
  }

  onConsulted(): void {
    this.closeConsult();
    this.reload();
  }

  // ─────────── details / note dialogs ───────────

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
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

  consultationLabel(row: CustomerListItem): string {
    return this.t(
      row.isConsulted
        ? 'customers.consultation.badgeDone'
        : 'customers.consultation.badgePending',
    );
  }

  trackById = (_: number, r: CustomerListItem) => r.id;

  // ─────────── export / print ───────────

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
        header: this.t('customers.consultation.column'),
        value: (r) => this.consultationLabel(r),
      },
      {
        header: this.t('customers.table.salesPerson'),
        value: (r) => r.salesPersonName,
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

  readonly fetchAllRows = async (): Promise<CustomerListItem[]> => {
    const page = await firstValueFrom(
      this.customers.listForSupport({
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
