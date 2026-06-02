import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { CustomersService } from '../../../leads/services/customers.service';
import { ContractsService } from '../../../salesPhases/services/contracts.service';
import { SupportTicketsService } from '../../../appSupport/services/support-tickets.service';
import { MarketingService } from '../../services/marketing.service';
import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AdminDashboardData,
  ContractListItem,
  CustomerListItem,
  SourcePerformanceItem,
  SupportTicket,
  SUPPORT_TICKET_PRIORITY_MAP,
  SUPPORT_TICKET_STATUS_MAP,
} from '../../../../shared/models';

/** Ordered month keys — backend `month` (1–12) indexes into this for i18n. */
const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    TranslatePipe,
    MoneyPipe,
    PageHeaderComponent,
    LoadErrorComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private readonly lang = inject(LanguageService);
  private readonly adminDashboard = inject(AdminDashboardService);
  private readonly marketing = inject(MarketingService);
  private readonly customers = inject(CustomersService);
  private readonly contracts = inject(ContractsService);
  private readonly tickets = inject(SupportTicketsService);
  private readonly router = inject(Router);

  // ─────────── state ───────────
  readonly data = signal<AdminDashboardData | null>(null);
  readonly sourcePerformance = signal<SourcePerformanceItem[]>([]);
  readonly recentLeads = signal<CustomerListItem[]>([]);
  readonly recentDeals = signal<ContractListItem[]>([]);
  readonly recentTickets = signal<SupportTicket[]>([]);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // ─────────── charts (rebuilt when language or data changes) ───────────

  /** Revenue overview — monthly revenue line/area. */
  readonly revenueChart = computed(() => {
    const points = this.data()?.monthlyRevenue ?? [];
    return {
      series: [
        {
          name: this.t('dashboard.admin.revenueSeries'),
          data: points.map((p) => p.revenue),
        },
      ],
      chart: {
        type: 'area' as const,
        height: 320,
        toolbar: { show: false },
        fontFamily: 'inherit',
        zoom: { enabled: false },
      },
      xaxis: { categories: points.map((p) => this.monthLabel(p.month, p.monthName)) },
      yaxis: {
        labels: { formatter: (v: number) => this.formatCurrency(Math.round(v)) },
        title: { text: this.revenueAxisTitle() },
      },
      stroke: { curve: 'smooth' as const, width: 3 },
      colors: ['#0066cc'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--border)' },
      tooltip: { y: { formatter: (v: number) => this.formatCurrency(v) } },
    };
  });

  /** Sales conversion rate — monthly buyers as columns. */
  readonly conversionChart = computed(() => {
    const points = this.data()?.monthlyBuyers ?? [];
    return {
      series: [
        {
          name: this.t('dashboard.admin.buyersSeries'),
          data: points.map((p) => p.count),
        },
      ],
      chart: {
        type: 'bar' as const,
        height: 320,
        toolbar: { show: false },
        fontFamily: 'inherit',
      },
      xaxis: { categories: points.map((p) => this.monthLabel(p.month, p.monthName)) },
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
      plotOptions: { bar: { columnWidth: '50%', borderRadius: 6 } },
      colors: ['#10b981'],
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--border)' },
      tooltip: { y: { formatter: (v: number) => `${v}` } },
    };
  });

  /** Leads sources — customers per platform as a donut. */
  readonly leadsSourcesChart = computed(() => {
    const items = this.sourcePerformance();
    return {
      series: items.map((i) => i.customersCount),
      chart: {
        type: 'donut' as const,
        height: 320,
        fontFamily: 'inherit',
      },
      labels: items.map((i) => i.sourceName),
      colors: ['#0066cc', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'],
      legend: { position: 'bottom' as const },
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
      plotOptions: {
        pie: {
          donut: {
            size: '62%',
            labels: {
              show: true,
              total: {
                show: true,
                label: this.t('dashboard.marketing.customers'),
                formatter: () =>
                  `${items.reduce((sum, i) => sum + (i.customersCount ?? 0), 0)}`,
              },
            },
          },
        },
      },
      stroke: { width: 2, colors: ['var(--surface, #fff)'] },
      responsive: [
        {
          breakpoint: 480,
          options: { chart: { height: 280 }, legend: { position: 'bottom' as const } },
        },
      ],
    };
  });

  private readonly revenueAxisTitle = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return `${resolveKey(d, 'dashboard.revenue')} ( ${resolveKey(d, 'dashboard.currency')} )`;
  });

  // ─────────── load ───────────

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      admin: this.adminDashboard.dashboard(),
      sources: this.marketing.sourcePerformance(),
      leads: this.customers.list({ PageIndex: 1, PageSize: 5 }),
      deals: this.contracts.list({ PageIndex: 1, PageSize: 5 }),
      tickets: this.tickets.list({ PageIndex: 1, PageSize: 5 }),
    }).subscribe({
      next: (res) => {
        this.data.set(res.admin);
        this.sourcePerformance.set(res.sources ?? []);
        this.recentLeads.set(res.leads.data ?? []);
        this.recentDeals.set(res.deals.data ?? []);
        this.recentTickets.set(res.tickets.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('dashboard.admin.loadFailed'));
      },
    });
  }

  // ─────────── ticket badges ───────────

  ticketStatusLabel(status: number): string {
    const meta = SUPPORT_TICKET_STATUS_MAP[status];
    return meta ? this.t(meta.i18nKey) : '—';
  }

  ticketStatusBadge(status: number): string {
    switch (status) {
      case 0: return 'bg-primary-subtle text-primary'; // Open
      case 1: return 'bg-info-subtle text-info'; // InProgress
      case 2: return 'bg-warning-subtle text-warning'; // WaitingCustomer
      case 3: return 'bg-success-subtle text-success'; // Resolved
      case 4: return 'bg-secondary-subtle text-secondary'; // Closed
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  ticketPriorityLabel(priority: number): string {
    const meta = SUPPORT_TICKET_PRIORITY_MAP[priority];
    return meta ? this.t(meta.i18nKey) : '—';
  }

  ticketPriorityBadge(priority: number): string {
    switch (priority) {
      case 1: return 'bg-danger-subtle text-danger'; // High
      case 2: return 'bg-warning-subtle text-warning'; // Medium
      case 3: return 'bg-success-subtle text-success'; // Low
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  // ─────────── KPI change indicator ───────────

  changeClass(pct: number | null | undefined): string {
    return (pct ?? 0) < 0 ? 'text-danger' : 'text-success';
  }

  changeArrow(pct: number | null | undefined): string {
    return (pct ?? 0) < 0 ? '↓' : '↑';
  }

  changeValue(pct: number | null | undefined): number {
    return Math.abs(pct ?? 0);
  }

  // ─────────── helpers ───────────

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '0';
    return new Intl.NumberFormat(
      this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
    ).format(value);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric' },
      );
    } catch {
      return iso;
    }
  }

  /** Localized month name from the backend month number, falling back to the served name. */
  private monthLabel(month: number, fallback: string): string {
    const key = MONTH_KEYS[month - 1];
    if (!key) return fallback;
    const label = this.t(`dashboard.months.${key}`);
    return label.startsWith('dashboard.') ? fallback : label;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }

  // ─────────── navigation ───────────

  goToLeads(): void {
    this.router.navigate(['/leads/marketing-leadsCustomer']);
  }

  goToDeals(): void {
    this.router.navigate(['/contracts']);
  }

  goToTickets(): void {
    this.router.navigate(['/SupportTickets']);
  }
}
