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
import { ActivatedRoute, Router } from '@angular/router';
import {
  Observable,
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import {
  dateRangeFromParams,
  isDateRangeActive,
  toDateRangeParams,
} from '../../../../core/utils/date-range.util';
import { CreatedAtComponent } from '../../../../shared/components/created-at/created-at.component';
import { CustomerDateRangeFilterComponent } from '../../../../shared/components/customer-date-range-filter/customer-date-range-filter.component';
import { DateRangeChipComponent } from '../../../../shared/components/customer-date-range-filter/date-range-chip.component';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import {
  CustomerFollowUpResponse,
  AssignSupportResponse,
  Country,
  CustomerDateFilter,
  CustomerListItem,
  CustomerListQuery,
  CustomerNoteResponse,
  CustomerStatus,
  EGYPT_COUNTRY_ID,
  Governorate,
  PagedResult,
  SalesPerson,
} from '../../../../shared/models';
import { LocationLookupsService } from '../../../../core/services/location-lookups.service';
import { CustomerLocationComponent } from '../../../../shared/components/customer-location/customer-location.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatCairoDate } from '../../../../shared/pipes/cairo-date.pipe';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { AssignSupportDialogComponent } from '../../components/assign-support-dialog/assign-support-dialog.component';
import { ChangeStatusDialogComponent } from '../../components/change-status-dialog/change-status-dialog.component';
import { LogContactDialogComponent } from '../../components/log-contact-dialog/log-contact-dialog.component';
import { CustomerActivitiesDialogComponent } from '../../components/customer-activities-dialog/customer-activities-dialog.component';
import {
  CustomerActionsConfig,
  CustomerActionsMenuComponent,
} from '../../components/customer-actions-menu/customer-actions-menu.component';
import {
  CustomerDetailsDialogComponent,
  CustomerDetailsTab,
} from '../../components/customer-details-dialog/customer-details-dialog.component';
import { CustomerNoteDialogComponent } from '../../components/customer-note-dialog/customer-note-dialog.component';
import { CustomerNotesCellComponent } from '../../components/customer-notes-cell/customer-notes-cell.component';
import { FollowUpDialogComponent } from '../../components/follow-up-dialog/follow-up-dialog.component';
import { CustomersService } from '../../services/customers.service';
import { NewBuyerContractService } from '../../../salesPhases/services/new-buyer-contract.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../utils/customer-status.util';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { fetchAllPages } from '../../utils/fetch-all-pages.util';
import { UNASSIGNED_SALES, salesPersonQuery } from '../../utils/sales-person-query.util';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Which customer list this page renders (route `data.customerList`):
 *   - `sales`  — `GET Customers/getSalesCustomers` (Admin, Sales)
 *   - `buyers` — `GET Customers/buyers` (Admin, Sales, Support); every row is
 *                a Buyer, so there is no status filter.
 */
export type CustomerListKind = 'sales' | 'buyers';

type Audience = 'admin' | 'own';

interface ListCopy {
  icon: string;
  titleKey: string;
  welcomeTitleKey: string;
  subtitleKey: Record<Audience, string>;
  welcomeSubtitleKey: Record<Audience, string>;
  emptyKey: Record<Audience, string>;
  emptyFilteredKey: string;
}

const LIST_COPY: Record<CustomerListKind, ListCopy> = {
  sales: {
    icon: 'fa-solid fa-user-tie',
    titleKey: 'customers.sales.title',
    welcomeTitleKey: 'customers.sales.welcomeTitle',
    subtitleKey: { admin: 'customers.sales.subtitleAdmin', own: 'customers.sales.subtitleSales' },
    welcomeSubtitleKey: {
      admin: 'customers.sales.welcomeSubtitleAdmin',
      own: 'customers.sales.welcomeSubtitleSales',
    },
    emptyKey: { admin: 'customers.sales.emptyAdmin', own: 'customers.sales.empty' },
    emptyFilteredKey: 'customers.table.emptyFiltered',
  },
  buyers: {
    icon: 'fa-solid fa-handshake',
    titleKey: 'customers.buyers.title',
    welcomeTitleKey: 'customers.buyers.welcomeTitle',
    subtitleKey: { admin: 'customers.buyers.subtitleAdmin', own: 'customers.buyers.subtitleOwn' },
    welcomeSubtitleKey: {
      admin: 'customers.buyers.welcomeSubtitleAdmin',
      own: 'customers.buyers.welcomeSubtitleOwn',
    },
    emptyKey: { admin: 'customers.buyers.empty', own: 'customers.buyers.empty' },
    emptyFilteredKey: 'customers.buyers.emptyFiltered',
  },
};

interface KpiTile {
  labelKey: string;
  value: number;
  icon: string;
  tone: 'primary' | 'info' | 'warning' | 'success';
}

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
    TipDirective,
    CustomerDetailsDialogComponent,
    AssignSupportDialogComponent,
    ChangeStatusDialogComponent,
    FollowUpDialogComponent,
    LogContactDialogComponent,
    CustomerActivitiesDialogComponent,
    CustomerNoteDialogComponent,
    CustomerNotesCellComponent,
    CustomerActionsMenuComponent,
    ClampTextDirective,
    ResponsiveTableDirective,
    CustomerLocationComponent,
    CustomerDateRangeFilterComponent,
    DateRangeChipComponent,
    CreatedAtComponent,
    TableSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-leads.component.html',
  styleUrl: './sales-leads.component.scss',
})
/**
 * Sales customers table and, on `/leads/buyers`, the Buyers table: one
 * component so both lists share the same columns, filters, row actions and
 * dialogs. The differences (endpoint, copy, status filter, KPIs, actions)
 * hang off {@link CustomerListKind}.
 */
export class SalesLeadsComponent implements OnInit, OnDestroy {
  private readonly customers = inject(CustomersService);
  private readonly newBuyerContract = inject(NewBuyerContractService);
  private readonly channelSources = inject(ChannelSourcesService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locations = inject(LocationLookupsService);

  // ─────────── search / filter ───────────
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly kind: CustomerListKind =
    this.route.snapshot.data['customerList'] === 'buyers' ? 'buyers' : 'sales';
  readonly isBuyers = this.kind === 'buyers';
  readonly copy = LIST_COPY[this.kind];
  /** Buyers are all one status, so the status filter would be a no-op there. */
  readonly showStatusFilter = !this.isBuyers;

  readonly searchSignal = signal('');
  readonly selectedStatusId = signal<number | null>(null);
  /** "Date added" range (`From` / `To`). */
  readonly dateFilter = signal<CustomerDateFilter>({});
  readonly selectedSourceId = signal<number | null>(null);
  /** Effective country; `0` = unknown country. */
  readonly selectedCountryId = signal<number | null>(null);
  /** `0` = Egyptian customers without a governorate. */
  readonly selectedGovernorateId = signal<number | null>(null);
  readonly countries = signal<Country[]>([]);
  readonly governorates = signal<Governorate[]>([]);

  /** Sales-rep filter, sent to the server: `SalesPersonId`, or `Unassigned=true` for `UNASSIGNED_SALES`. */
  readonly selectedSalesPersonId = signal<string | null>(null);
  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly unassignedSales = UNASSIGNED_SALES;
  /** Every row matching the server filters + the rep, while a rep is selected. */
  /** Drops answers of superseded loads (fast filter switching). */
  private loadSeq = 0;

  /** Governorates only narrow Egypt (or "any country"). */
  readonly governorateFilterApplies = computed(() => {
    const country = this.selectedCountryId();
    return country === null || country === EGYPT_COUNTRY_ID;
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchSignal() ||
      this.selectedStatusId() !== null ||
      this.selectedSourceId() !== null ||
      this.selectedCountryId() !== null ||
      this.selectedGovernorateId() !== null ||
      this.selectedSalesPersonId() !== null ||
      isDateRangeActive(this.dateFilter()),
  );

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
  /** Which tab the details dialog opens on (the WhatsApp button opens the chat). */
  readonly detailsTab = signal<CustomerDetailsTab>('details');
  readonly assignSupportDialog = signal<CustomerListItem | null>(null);
  readonly changeStatusDialog = signal<CustomerListItem | null>(null);
  readonly followUpDialog = signal<CustomerListItem | null>(null);
  readonly logContactDialog = signal<CustomerListItem | null>(null);
  readonly activitiesDialog = signal<CustomerListItem | null>(null);
  readonly noteDialog = signal<CustomerListItem | null>(null);

  /** True when the current user is an Admin — drives subtitle/empty copy. */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  /** Admin + Sales work the deal (status, follow-ups, contracts); Support reads + notes. */
  readonly isSalesSide = computed(() => {
    const role = this.auth.currentRole();
    return role === 'Admin' || role === 'Sales';
  });

  private readonly audience = computed<Audience>(() => (this.isAdmin() ? 'admin' : 'own'));
  readonly subtitleKey = computed(() => this.copy.subtitleKey[this.audience()]);
  readonly emptyMessageKey = computed(() => this.copy.emptyKey[this.audience()]);
  readonly welcomeSubtitleKey = computed(() => this.copy.welcomeSubtitleKey[this.audience()]);

  /**
   * Row toolbar, by role:
   *   - Admin / Sales: view + note inline; assign-support, status, follow-up,
   *     contact log, activities (+ "add contract" on buyers) in the menu.
   *   - Support (buyers only): view, note, WhatsApp, activities; the deal
   *     itself is owned by sales.
   * Marketing-only actions (edit/delete/assign-sales) are explicitly off.
   */
  readonly actionsConfig: CustomerActionsConfig = this.isSalesSide()
    ? {
        view: true,
        note: true,
        whatsapp: true,
        assignSupport: true,
        changeStatus: true,
        followUp: true,
        logContact: true,
        activities: true,
        addContract: this.isBuyers,
      }
    : { view: true, note: true, whatsapp: true, activities: true };

  /** KPI tiles: the total is the server count, the rest describe the loaded page. */
  readonly kpiTiles = computed<KpiTile[]>(() => {
    const list = this.rows();
    const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    const second: KpiTile = this.isBuyers
      ? {
          labelKey: 'customers.kpi.consulted',
          value: list.filter((r) => !!r.isConsulted).length,
          icon: 'fa-solid fa-user-check',
          tone: 'info',
        }
      : {
          labelKey: 'customers.kpi.newLeads',
          value: list.filter((r) => lower(r.status) === 'new').length,
          icon: 'fa-solid fa-user-plus',
          tone: 'info',
        };
    return [
      { labelKey: 'customers.kpi.total', value: this.count(), icon: 'fa-solid fa-users', tone: 'primary' },
      second,
      {
        labelKey: 'customers.kpi.pendingFollowUp',
        value: list.filter((r) => !!r.nextFollowUpDate).length,
        icon: 'fa-solid fa-calendar-check',
        tone: 'warning',
      },
      {
        labelKey: 'customers.kpi.transferredToSupport',
        value: list.filter((r) => !!r.isSalesToSupport).length,
        icon: 'fa-solid fa-headset',
        tone: 'success',
      },
    ];
  });

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });

    this.applyLinkFilters();
    this.loadFilters();
    this.reload();
  }

  /** Deep links (e.g. from the customer map): `?countryId=20&governorateId=1&from=…&to=…`. */
  private applyLinkFilters(): void {
    const params = this.route.snapshot.queryParamMap;
    const id = (key: string) => {
      const raw = params.get(key);
      const n = raw === null || raw === '' ? NaN : Number(raw);
      return Number.isInteger(n) && n >= 0 ? n : null;
    };
    this.selectedCountryId.set(id('countryId'));
    this.selectedGovernorateId.set(this.governorateFilterApplies() ? id('governorateId') : null);
    this.dateFilter.set(dateRangeFromParams(params.get('from'), params.get('to')));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  private loadFilters(): void {
    if (this.showStatusFilter) {
      this.customers.statuses().subscribe({
        next: (items) => this.statuses.set(items),
      });
    }
    this.channelSources.list().subscribe({
      next: (items: SourceItem[]) => this.sources.set(items),
    });
    this.locations.countries().subscribe({ next: (rows) => this.countries.set(rows), error: () => undefined });
    this.locations.governorates().subscribe({ next: (rows) => this.governorates.set(rows), error: () => undefined });
    if (this.isAdmin()) {
      this.customers.salesTeam().subscribe({
        next: (team) => this.salesTeam.set([...(team ?? [])].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ar'))),
        error: () => undefined,
      });
    }
  }

  /** The list query for the current filters (table, export). Empty filters stay `undefined`. */
  private listQuery(pageIndex: number, pageSize: number): CustomerListQuery {
    return {
      PageIndex: pageIndex,
      PageSize: pageSize,
      Search: this.searchSignal().trim() || undefined,
      CustomerStatusId: this.showStatusFilter ? this.selectedStatusId() ?? undefined : undefined,
      SourceId: this.selectedSourceId() ?? undefined,
      CountryId: this.selectedCountryId() ?? undefined,
      GovernorateId: this.governorateFilterApplies() ? this.selectedGovernorateId() ?? undefined : undefined,
      ...toDateRangeParams(this.dateFilter()),
      ...salesPersonQuery(this.selectedSalesPersonId()),
    };
  }

  /** The endpoint behind this list. */
  private fetchPage(query: CustomerListQuery, force = false): Observable<PagedResult<CustomerListItem>> {
    return this.isBuyers
      ? this.customers.buyers(query, force)
      : this.customers.listForSales(query, force);
  }

  reload(force = false): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    this.fetchPage(this.listQuery(this.pageIndex(), this.pageSize()), force)
      .subscribe({
        next: (page) => {
          if (seq !== this.loadSeq) return;
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          if (seq !== this.loadSeq) return;
          this.loading.set(false);
          this.loadError.set(this.t('customers.messages.loadFailed'));
        },
      });
  }

  /** Applies a row patch to the visible page AND the rep-filtered set. */
  private patchRows(mapper: (list: CustomerListItem[]) => CustomerListItem[]): void {
    this.rows.update(mapper);
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

  onCountryChange(id: string): void {
    this.selectedCountryId.set(id === '' || id == null ? null : Number(id));
    // Another country has no governorates — drop a stale governorate filter.
    if (!this.governorateFilterApplies()) this.selectedGovernorateId.set(null);
    this.pageIndex.set(1);
    this.reload();
  }

  onSalesPersonChange(id: string): void {
    this.selectedSalesPersonId.set(id || null);
    this.pageIndex.set(1);
    this.reload();
  }

  /** Date-added range changed (picker, preset or chip): back to page 1. */
  onDateFilterChange(range: CustomerDateFilter): void {
    this.dateFilter.set(range);
    this.pageIndex.set(1);
    this.reload();
  }

  onGovernorateChange(id: string): void {
    this.selectedGovernorateId.set(id === '' || id == null ? null : Number(id));
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
    this.detailsTab.set('details');
    this.detailsDialog.set(row.id);
  }

  openWhatsApp(row: CustomerListItem): void {
    this.detailsTab.set('whatsapp');
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

  /** Patch the row from `data.customer` — no full reload for a one-row change. */
  onSupportAssigned(res: AssignSupportResponse): void {
    this.closeAssignSupport();
    const updated = res?.customer;
    if (!updated?.id) {
      this.reload();
      return;
    }
    this.patchRows((list) =>
      list.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
    );
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
    this.patchRows((list) =>
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
    this.patchRows((list) =>
      list.map((row) =>
        row.id === res.id
          ? { ...row, lastFollowUpDate: res.lastFollowUpDate, nextFollowUpDate: null }
          : row,
      ),
    );
    this.closeLogContact();
  }

  /** Buyers: start this customer's contract (create dialog on the contracts page). */
  openAddContract(row: CustomerListItem): void {
    this.newBuyerContract.openNewContract(row.id);
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
    this.patchRows((list) =>
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

  /** Server timestamps are UTC without a `Z`; read as UTC, shown in Cairo time. */
  formatDate(dateStr: string | null | undefined): string {
    return formatCairoDate(dateStr, this.language.lang(), 'date');
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
      { header: this.t('customers.details.company'), value: (r) => r.campanyName },
      { header: this.t('customers.table.phone'), value: (r) => r.phone },
      { header: this.t('customers.table.address'), value: (r) => r.address },
      {
        header: this.t('customers.location.country'),
        value: (r) =>
          r.countryName
            ? r.countryInferred
              ? `${r.countryName} (${this.t('customers.location.inferredShort')})`
              : r.countryName
            : null,
      },
      { header: this.t('customers.location.governorate'), value: (r) => r.governorateName },
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
        header: this.t('dateFilter.createdAt'),
        value: (r) => this.formatDate(r.createdAt),
      },
    ];
  }

  /** Export: every matching row, page by page (the server caps a page at 50). */
  readonly fetchAllRows = async (): Promise<CustomerListItem[]> => {
    return fetchAllPages((pageIndex, pageSize) => this.fetchPage(this.listQuery(pageIndex, pageSize)));
  };

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
