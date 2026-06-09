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
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  CustomerFollowUpResponse,
  CustomerListItem,
  CustomerNoteResponse,
  CustomerStatus,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { AssignSupportDialogComponent } from '../../components/assign-support-dialog/assign-support-dialog.component';
import { ChangeStatusDialogComponent } from '../../components/change-status-dialog/change-status-dialog.component';
import { LogContactDialogComponent } from '../../components/log-contact-dialog/log-contact-dialog.component';
import { CustomerActivitiesDialogComponent } from '../../components/customer-activities-dialog/customer-activities-dialog.component';
import {
  CustomerActionsConfig,
  CustomerActionsMenuComponent,
} from '../../components/customer-actions-menu/customer-actions-menu.component';
import { CustomerDetailsDialogComponent } from '../../components/customer-details-dialog/customer-details-dialog.component';
import { CustomerNoteDialogComponent } from '../../components/customer-note-dialog/customer-note-dialog.component';
import { CustomerNotesCellComponent } from '../../components/customer-notes-cell/customer-notes-cell.component';
import { FollowUpDialogComponent } from '../../components/follow-up-dialog/follow-up-dialog.component';
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

interface JourneyStep {
  icon: string;
  labelKey: string;
  role: 'marketing' | 'sales' | 'support';
  /** passed = completed ✓ | active = current ● | pending = not yet ○ */
  state: 'passed' | 'active' | 'pending';
}

@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PaginationComponent,
    StatCardComponent,
    LoadErrorComponent,
    EmptyStateComponent,
    TableToolsComponent,
    CustomerDetailsDialogComponent,
    AssignSupportDialogComponent,
    ChangeStatusDialogComponent,
    FollowUpDialogComponent,
    LogContactDialogComponent,
    CustomerActivitiesDialogComponent,
    CustomerNoteDialogComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
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
  private readonly router = inject(Router);

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
  readonly assignSupportDialog = signal<CustomerListItem | null>(null);
  readonly changeStatusDialog = signal<CustomerListItem | null>(null);
  readonly followUpDialog = signal<CustomerListItem | null>(null);
  readonly logContactDialog = signal<CustomerListItem | null>(null);
  readonly activitiesDialog = signal<CustomerListItem | null>(null);
  readonly noteDialog = signal<CustomerListItem | null>(null);

  /** True when the current user is an Admin — drives subtitle/empty copy. */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  readonly subtitleKey = computed(() =>
    this.isAdmin() ? 'customers.sales.subtitleAdmin' : 'customers.sales.subtitleSales',
  );

  readonly emptyMessageKey = computed(() =>
    this.isAdmin() ? 'customers.sales.emptyAdmin' : 'customers.sales.empty',
  );

  readonly welcomeSubtitleKey = computed(() =>
    this.isAdmin()
      ? 'customers.sales.welcomeSubtitleAdmin'
      : 'customers.sales.welcomeSubtitleSales',
  );

  /**
   * Action surface for the row toolbar. Sales-specific:
   *   - inline: view + note (high-frequency)
   *   - dropdown: assign-support, change-status, follow-up
   * Marketing-only actions (edit/delete/assign-sales) are explicitly off.
   */
  readonly actionsConfig: CustomerActionsConfig = {
    view: true,
    note: true,
    assignSupport: true,
    changeStatus: true,
    followUp: true,
    logContact: this.auth.currentRole() === 'Sales' || this.auth.currentRole() === 'Admin',
    activities: true,
  };

  /** Page-scope KPIs derived from the loaded rows. */
  readonly kpis = computed(() => {
    const list = this.rows();
    const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    return {
      total: this.count(),
      pendingFollowUp: list.filter((r) => !!r.nextFollowUpDate).length,
      transferredToSupport: list.filter((r) => !!r.isSalesToSupport).length,
      newLeads: list.filter((r) => lower(r.status) === 'new').length,
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

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.customers
      .listForSales(
        {
          PageIndex: this.pageIndex(),
          PageSize: this.pageSize(),
          Search: this.searchSignal().trim() || undefined,
          CustomerStatusId: this.selectedStatusId() ?? undefined,
          SourceId: this.selectedSourceId() ?? undefined,
        },
        force,
      )
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

  /** CTA in the page header — same form Marketing uses, role-aware on return. */
  goToAddCustomer(): void {
    this.router.navigate(['/leads/add-leadCustomer']);
  }

  // ─────────── dialogs ───────────

  openDetails(row: CustomerListItem): void {
    this.detailsDialog.set(row.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
  }

  openAssignSupport(row: CustomerListItem): void {
    this.assignSupportDialog.set(row);
  }

  closeAssignSupport(): void {
    this.assignSupportDialog.set(null);
  }

  onSupportAssigned(): void {
    this.closeAssignSupport();
    this.reload();
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

  openLogContact(row: CustomerListItem): void {
    this.logContactDialog.set(row);
  }

  closeLogContact(): void {
    this.logContactDialog.set(null);
  }

  onContactLogged(res: CustomerFollowUpResponse): void {
    this.rows.update((list) =>
      list.map((row) =>
        row.id === res.id
          ? { ...row, lastFollowUpDate: res.lastFollowUpDate, nextFollowUpDate: null }
          : row,
      ),
    );
    this.closeLogContact();
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

  // ─────────── journey stepper ───────────

  /**
   * Builds the ordered stage list for the pipeline stepper.
   * Always shows ALL stages so the current position is obvious at a glance.
   *
   *   isMarketingToSales only  → [✓ تسويق] [● مبيعات] [○ دعم]
   *   + isSalesToSupport        → [✓ تسويق] [✓ مبيعات] [● دعم]
   *   + isSupportToSales        → [✓ تسويق] [✓ مبيعات] [✓ دعم] [● مبيعات]
   */
  buildJourney(row: CustomerListItem): JourneyStep[] {
    if (!row.isMarketingToSales && !row.isSalesToSupport && !row.isSupportToSales) return [];

    if (row.isSupportToSales) {
      return [
        { icon: 'fa-solid fa-bullhorn',    labelKey: 'customers.journey.marketing', role: 'marketing', state: 'passed' },
        { icon: 'fa-solid fa-user-tie',    labelKey: 'customers.journey.sales',     role: 'sales',     state: 'passed' },
        { icon: 'fa-solid fa-headset',     labelKey: 'customers.journey.support',   role: 'support',   state: 'passed' },
        { icon: 'fa-solid fa-rotate-left', labelKey: 'customers.journey.sales',     role: 'sales',     state: 'active' },
      ];
    }

    if (row.isSalesToSupport) {
      return [
        { icon: 'fa-solid fa-bullhorn', labelKey: 'customers.journey.marketing', role: 'marketing', state: 'passed'  },
        { icon: 'fa-solid fa-user-tie', labelKey: 'customers.journey.sales',     role: 'sales',     state: 'passed'  },
        { icon: 'fa-solid fa-headset',  labelKey: 'customers.journey.support',   role: 'support',   state: 'active'  },
      ];
    }

    return [
      { icon: 'fa-solid fa-bullhorn', labelKey: 'customers.journey.marketing', role: 'marketing', state: 'passed'  },
      { icon: 'fa-solid fa-user-tie', labelKey: 'customers.journey.sales',     role: 'sales',     state: 'active'  },
      { icon: 'fa-solid fa-headset',  labelKey: 'customers.journey.support',   role: 'support',   state: 'pending' },
    ];
  }

  /** CSS class for the connector line between steps.
   *  Colored with the "from" step's role color unless the target step is pending. */
  stepConnectorClass(steps: JourneyStep[], index: number): string {
    if (steps[index].state === 'pending') return 'is-pending';
    return `role-${steps[index - 1].role}`;
  }

  // ─────────── helpers ───────────

  /** Two-letter initials used in the identity avatar. */
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

  followUpState(row: CustomerListItem): {
    type: 'overdue' | 'today' | 'tomorrow' | null;
    daysAgo: number;
  } {
    if (!row.nextFollowUpDate) return { type: null, daysAgo: 0 };
    const due = new Date(row.nextFollowUpDate);
    if (Number.isNaN(due.getTime())) return { type: null, daysAgo: 0 };
    const startOf = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOf(due) - startOf(new Date())) / 86_400_000);
    if (diffDays < 0) return { type: 'overdue', daysAgo: Math.abs(diffDays) };
    if (diffDays === 0) return { type: 'today', daysAgo: 0 };
    if (diffDays === 1) return { type: 'tomorrow', daysAgo: 0 };
    return { type: null, daysAgo: 0 };
  }

  followUpTdClass(row: CustomerListItem): string {
    const { type } = this.followUpState(row);
    if (type === 'overdue') return 'fu-cell-overdue';
    if (type === 'today') return 'fu-cell-today';
    if (type === 'tomorrow') return 'fu-cell-tomorrow';
    return '';
  }

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
        header: this.t('customers.table.salesPerson'),
        value: (r) => r.salesPersonName,
      },
      {
        header: this.t('customers.table.supportPerson'),
        value: (r) => r.supportPersonName,
      },
      {
        header: this.t('customers.consultation.column'),
        value: (r) =>
          this.t(
            r.isConsulted
              ? 'customers.consultation.badgeDone'
              : 'customers.consultation.badgePending',
          ),
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
        header: this.t('customers.table.lastFollowUp'),
        value: (r) => this.formatDate(r.lastFollowUpDate),
      },
      {
        header: this.t('customers.table.nextFollowUp'),
        value: (r) => this.formatDate(r.nextFollowUpDate),
      },
      {
        header: this.t('customers.table.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
    ];
  }

  readonly fetchAllRows = async (): Promise<CustomerListItem[]> => {
    const page = await firstValueFrom(
      this.customers.listForSales({
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
