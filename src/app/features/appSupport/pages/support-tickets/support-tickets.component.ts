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
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  AppService,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_MAP,
  SUPPORT_TICKET_STATUS_MAP,
  SUPPORT_TICKET_STATUSES,
  SupportTicket,
  SupportTicketListQuery,
  SupportTicketPriorityMeta,
  SupportTicketPriorityName,
  SupportTicketStatistics,
  SupportTicketStatus,
  SupportTicketStatusMeta,
  SupportTicketStatusName,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupportTicketDetailsDialogComponent } from '../../components/support-ticket-details-dialog/support-ticket-details-dialog.component';
import { SupportTicketFormDialogComponent } from '../../components/support-ticket-form-dialog/support-ticket-form-dialog.component';
import { SupportTicketsService } from '../../services/support-tickets.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PageHeaderComponent,
    StatCardComponent,
    PaginationComponent,
    LoadErrorComponent,
    TableToolsComponent,
    SupportTicketFormDialogComponent,
    SupportTicketDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-tickets.component.html',
  styleUrl: './support-tickets.component.scss',
})
export class SupportTicketsComponent implements OnInit, OnDestroy {
  private readonly service = inject(SupportTicketsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  // ─── data ───
  readonly rows = signal<SupportTicket[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly statistics = signal<SupportTicketStatistics | null>(null);

  /** serviceId → service, for bilingual service names in the table. */
  private readonly serviceMap = signal<Record<number, AppService>>({});

  // ─── pagination ───
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  // ─── filters ───
  searchTerm = '';
  readonly search = signal('');
  readonly statusFilter = signal<SupportTicketStatusName | ''>('');
  readonly priorityFilter = signal<SupportTicketPriorityName | ''>('');

  // ─── dialogs ───
  readonly formOpen = signal(false);
  readonly editId = signal<number | null>(null);
  readonly detailsId = signal<number | null>(null);

  readonly priorities = SUPPORT_TICKET_PRIORITIES;
  readonly statuses = SUPPORT_TICKET_STATUSES;

  readonly stats = computed(() => {
    const s = this.statistics();
    return {
      total: s?.totalTickets ?? this.totalCount(),
      open: s?.openTickets ?? 0,
      inProgress: s?.inProgressTickets ?? 0,
      resolved: s?.resolvedTickets ?? 0,
      highPriority: s?.highPriorityTickets ?? 0,
    };
  });

  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.search.set(term);
        this.pageIndex.set(1);
        this.reload();
      });

    this.loadServices();
    this.reload();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── loaders ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list(this.buildQuery()).subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.totalCount.set(page.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('support.tickets.loadFailed'));
      },
    });
  }

  private loadStatistics(): void {
    this.service.statistics().subscribe({
      next: (s) => this.statistics.set(s),
    });
  }

  private loadServices(): void {
    this.service.servicesDropdown().subscribe({
      next: (list) => {
        const map: Record<number, AppService> = {};
        for (const s of list) map[s.id] = s;
        this.serviceMap.set(map);
      },
    });
  }

  private buildQuery(): SupportTicketListQuery {
    return {
      PageIndex: this.pageIndex(),
      PageSize: this.pageSize(),
      Search: this.search().trim() || undefined,
      Status: this.statusFilter() || undefined,
      Priority: this.priorityFilter() || undefined,
    };
  }

  // ─────────── filters ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onStatusChange(value: SupportTicketStatusName | ''): void {
    this.statusFilter.set(value);
    this.pageIndex.set(1);
    this.reload();
  }

  onPriorityChange(value: SupportTicketPriorityName | ''): void {
    this.priorityFilter.set(value);
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

  // ─────────── create / edit / details ───────────

  openCreate(): void {
    this.editId.set(null);
    this.formOpen.set(true);
  }

  openEdit(row: SupportTicket): void {
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

  openDetails(row: SupportTicket): void {
    this.detailsId.set(row.id);
  }

  closeDetails(): void {
    this.detailsId.set(null);
  }

  onDetailsEdit(id: number): void {
    this.detailsId.set(null);
    this.editId.set(id);
    this.formOpen.set(true);
  }

  async confirmDelete(row: SupportTicket): Promise<void> {
    if (this.busyId() === row.id) return;
    const ok = await this.dialog.confirm({
      title: this.t('support.tickets.deleteDialog.title'),
      message: this.t('support.tickets.deleteDialog.message'),
      confirmText: this.t('support.tickets.deleteDialog.confirm'),
      cancelText: this.t('support.tickets.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.service.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('support.tickets.messages.deleted'));
        // Step back a page if we just removed the last row on it.
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

  priorityMeta(row: SupportTicket): SupportTicketPriorityMeta | undefined {
    return SUPPORT_TICKET_PRIORITY_MAP[row.priority];
  }

  statusMeta(row: SupportTicket): SupportTicketStatusMeta | undefined {
    return SUPPORT_TICKET_STATUS_MAP[row.status];
  }

  /** Bilingual service name (falls back to the row's Arabic serviceName). */
  serviceLabel(row: SupportTicket): string {
    const svc = this.serviceMap()[row.serviceId];
    if (svc) {
      const name = this.language.lang() === 'ar' ? svc.nameAr : svc.nameEn;
      return name || svc.nameAr || svc.nameEn || row.serviceName;
    }
    return row.serviceName || '—';
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

  /** Date + time — used for the next-follow-up cell where the hour matters. */
  formatFollowUp(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Open tickets need a follow-up — drives the highlighted/alert cell. */
  isOpen(row: SupportTicket): boolean {
    return row.status === SupportTicketStatus.Open;
  }

  trackById = (_: number, r: SupportTicket) => r.id;

  // ─────────── export / print ───────────

  get exportColumns(): ExportColumn<SupportTicket>[] {
    return [
      {
        header: this.t('support.tickets.table.number'),
        value: (r) => `#${r.ticketNumber}`,
      },
      {
        header: this.t('support.tickets.table.customer'),
        value: (r) => r.customerName,
      },
      {
        header: this.t('support.tickets.details.company'),
        value: (r) => r.companyName ?? '—',
      },
      {
        header: this.t('support.tickets.table.service'),
        value: (r) => this.serviceLabel(r),
      },
      {
        header: this.t('support.tickets.table.ticketTitle'),
        value: (r) => r.title,
      },
      {
        header: this.t('support.tickets.table.priority'),
        value: (r) => {
          const m = this.priorityMeta(r);
          return m ? this.t(m.i18nKey) : String(r.priorityName);
        },
      },
      {
        header: this.t('support.tickets.table.status'),
        value: (r) => {
          const m = this.statusMeta(r);
          return m ? this.t(m.i18nKey) : String(r.statusName);
        },
      },
      {
        header: this.t('support.tickets.table.createdBy'),
        value: (r) =>
          r.createdByName || this.t('support.tickets.table.noCreator'),
      },
      {
        header: this.t('support.tickets.table.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
      {
        header: this.t('support.tickets.table.nextFollowUp'),
        value: (r) =>
          r.nextFollowUpDate ? this.formatFollowUp(r.nextFollowUpDate) : '—',
      },
    ];
  }

  get visibleExportRows(): SupportTicket[] {
    return this.rows();
  }

  /** Pull every page honouring the active filters (for "export all"). */
  readonly fetchAllRows = async (): Promise<SupportTicket[]> => {
    const page = await firstValueFrom(
      this.service.list({
        ...this.buildQuery(),
        PageIndex: 1,
        PageSize: this.totalCount() || this.pageSize(),
      }),
    );
    return page.data ?? [];
  };

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
