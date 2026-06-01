import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { catchError, forkJoin, of } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../shared/components/stat-card/stat-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CustomerListItem,
  SUPPORT_TICKET_PRIORITY_MAP,
  SUPPORT_TICKET_STATUS_MAP,
  SupportDashboard,
  SupportTicket,
} from '../../../../shared/models';
import { SupportTicketsService } from '../../../appSupport/services/support-tickets.service';
import { CustomersService } from '../../../leads/services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../../leads/utils/customer-status.util';

/** View-model for one KPI tile in the strip. */
interface KpiCard {
  labelKey: string;
  value: number | string;
  icon: string;
  tone: StatCardTone;
  valueClass: string;
  sub: string | null;
}

/**
 * Support dashboard (route `/appsupport-dashboard`).
 *
 * Three live data sources, loaded together and degrading independently
 * (a single failing call won't blank the whole page):
 *   - `GET /Support/Dashboard`            KPI strip + status donut + weekly trend
 *   - `GET /Customers/getSupportCustomers` last 5 clients handed over by sales
 *   - `GET /SupportTickets/GetTickets`     last 5 support tickets
 *
 * Quick-action buttons + the per-card CTAs route into the matching support
 * feature pages — nothing here is mocked.
 */
@Component({
  selector: 'app-appsupport-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    TranslatePipe,
    PageHeaderComponent,
    LoadErrorComponent,
    EmptyStateComponent,
    StatCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appsupport-dashboard.component.html',
  styleUrl: './appsupport-dashboard.component.scss',
})
export class AppsupportDashboardComponent implements OnInit {
  private readonly supportApi = inject(SupportTicketsService);
  private readonly customersApi = inject(CustomersService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  /** Rows shown in the "assigned clients" / "open tickets" preview cards. */
  private readonly PREVIEW_LIMIT = 5;

  /** Donut slice color per `SupportTicketStatus` id — mirrors the badge tokens. */
  private readonly STATUS_COLORS: Readonly<Record<number, string>> = {
    0: '#3b82f6', // Open       — blue
    1: '#f59e0b', // InProgress — amber
    2: '#7c3aed', // Waiting    — purple
    3: '#10b981', // Resolved   — green
    4: '#64748b', // Closed     — slate
  };

  /** Rough completion % per status, for the ticket card progress bars. */
  private readonly STATUS_PROGRESS: Readonly<Record<number, number>> = {
    0: 10, // Open
    1: 55, // InProgress
    2: 75, // WaitingCustomer
    3: 100, // Resolved
    4: 100, // Closed
  };

  // ─────────── state ───────────
  readonly dashboard = signal<SupportDashboard | null>(null);
  readonly assignedClients = signal<CustomerListItem[]>([]);
  readonly tickets = signal<SupportTicket[]>([]);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  /**
   * The six KPI tiles, derived from the dashboard payload. Driven as data so
   * the template renders them with a single `@for` (no repeated card markup).
   */
  readonly kpiCards = computed((): readonly KpiCard[] => {
    const d = this.dashboard();
    const target = d?.resolvedTodayTarget ?? 0;
    const resolved = d?.resolvedToday ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((resolved / target) * 100)) : 0;
    const high = d?.openHighPriority ?? 0;
    const critical = d?.criticalTickets ?? 0;
    return [
      {
        labelKey: 'dashboard.support.kpi.resolvedToday',
        value: resolved,
        icon: 'fa-solid fa-circle-check',
        tone: 'success',
        valueClass: 'text-success',
        sub: `${pct}% ${this.t('dashboard.support.kpi.ofTarget')}`,
      },
      {
        labelKey: 'dashboard.support.kpi.dailyTarget',
        value: target,
        icon: 'fa-solid fa-bullseye',
        tone: 'info',
        valueClass: '',
        sub: null,
      },
      {
        labelKey: 'dashboard.support.kpi.openTickets',
        value: d?.openTickets ?? 0,
        icon: 'fa-solid fa-ticket',
        tone: 'primary',
        valueClass: '',
        sub: null,
      },
      {
        labelKey: 'dashboard.support.kpi.highPriority',
        value: high,
        icon: 'fa-solid fa-fire-flame-curved',
        tone: 'warning',
        valueClass: high > 0 ? 'text-warning' : '',
        sub: null,
      },
      {
        labelKey: 'dashboard.support.kpi.assignedCustomers',
        value: d?.assignedCustomers ?? 0,
        icon: 'fa-solid fa-user-check',
        tone: 'purple',
        valueClass: '',
        sub: null,
      },
      {
        labelKey: 'dashboard.support.kpi.criticalTickets',
        value: critical,
        icon: 'fa-solid fa-triangle-exclamation',
        tone: 'danger',
        valueClass: critical > 0 ? 'text-danger' : '',
        sub: null,
      },
    ];
  });

  /** Total across all status buckets — drives the donut center + empty state. */
  readonly statusTotal = computed(() =>
    (this.dashboard()?.ticketsByStatus ?? []).reduce((sum, r) => sum + r.count, 0),
  );

  /** Render the trend whenever the API returns points — a flat line at 0 is fine. */
  readonly hasWeekly = computed(
    () => (this.dashboard()?.weeklyResolved ?? []).length > 0,
  );

  /**
   * Donut: ticket distribution by status. Built on demand from the latest
   * payload (the template only mounts `<apx-chart>` once data has landed, which
   * avoids the ng-apexcharts blank-on-empty-init quirk).
   */
  readonly statusChart = computed(() => {
    const rows = this.dashboard()?.ticketsByStatus ?? [];
    const series = rows.map((r) => r.count);
    const total = series.reduce((a, b) => a + b, 0);
    return {
      series,
      chart: {
        type: 'donut' as const,
        height: 340,
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout' as const,
          speed: 600,
          animateGradually: { enabled: true, delay: 150 },
        },
      },
      labels: rows.map((r) => this.ticketStatusLabel(r.statusId, r.statusName)),
      colors: rows.map((r) => this.STATUS_COLORS[r.statusId] ?? '#94a3b8'),
      legend: { position: 'bottom' as const, fontSize: '13px', fontFamily: 'inherit' },
      stroke: { width: 2, colors: ['var(--surface-1)'] },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${Math.round(val)}%`,
        style: { fontSize: '12px', fontWeight: 600 },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: this.t('dashboard.support.totalLabel'),
                fontSize: '14px',
                formatter: () => String(total),
              },
            },
          },
        },
      },
      tooltip: { y: { formatter: (val: number) => `${val}` } },
      responsive: [
        { breakpoint: 480, options: { chart: { height: 300 } } },
      ],
    };
  });

  /** Area: trailing-7-days resolved trend. */
  readonly weeklyChart = computed(() => {
    const points = this.dashboard()?.weeklyResolved ?? [];
    return {
      series: [
        {
          name: this.t('dashboard.support.resolvedSeries'),
          data: points.map((p) => p.count),
        },
      ],
      chart: {
        type: 'area' as const,
        height: 320,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, easing: 'easeinout' as const, speed: 700 },
      },
      xaxis: {
        categories: points.map((p) => this.formatShortDate(p.date)),
        labels: { style: { fontSize: '12px', colors: 'var(--text-3)' } },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: { formatter: (v: number) => `${Math.round(v)}` },
      },
      stroke: { curve: 'smooth' as const, width: 3 },
      colors: ['#10b981'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
      grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v: number) => `${v}` } },
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      dashboard: this.supportApi.dashboard().pipe(catchError(() => of(null))),
      clients: this.customersApi
        .listForSupport({ PageIndex: 1, PageSize: this.PREVIEW_LIMIT })
        .pipe(catchError(() => of(null))),
      tickets: this.supportApi
        .list({ PageIndex: 1, PageSize: this.PREVIEW_LIMIT })
        .pipe(catchError(() => of(null))),
    }).subscribe(({ dashboard, clients, tickets }) => {
      this.dashboard.set(dashboard);
      this.assignedClients.set(clients?.data ?? []);
      this.tickets.set(tickets?.data ?? []);
      if (!dashboard && !clients && !tickets) {
        this.loadError.set(this.t('dashboard.support.loadFailed'));
      }
      this.loading.set(false);
    });
  }

  // ─────────── quick actions / card CTAs ───────────

  goToDesignatedClients(): void {
    this.router.navigate(['/Designated-clients']);
  }
  goToTickets(): void {
    this.router.navigate(['/SupportTickets']);
  }
  goToKnowledgeBase(): void {
    this.router.navigate(['/knowledge-base']);
  }

  // ─────────── ticket helpers ───────────

  ticketStatusLabel(statusId: number, fallback?: string | null): string {
    const meta = SUPPORT_TICKET_STATUS_MAP[statusId];
    return meta ? this.t(meta.i18nKey) : fallback || '—';
  }

  ticketStatusBadgeClass(status: number): string {
    return SUPPORT_TICKET_STATUS_MAP[status]?.badgeClass ?? 'tkt-st--open';
  }

  ticketPriorityLabel(priority: number, fallback?: string | null): string {
    const meta = SUPPORT_TICKET_PRIORITY_MAP[priority];
    return meta ? this.t(meta.i18nKey) : fallback || '—';
  }

  ticketPriorityBadgeClass(priority: number): string {
    return SUPPORT_TICKET_PRIORITY_MAP[priority]?.badgeClass ?? 'tkt-prio--medium';
  }

  ticketPriorityIcon(priority: number): string {
    return SUPPORT_TICKET_PRIORITY_MAP[priority]?.icon ?? 'fa-solid fa-circle-half-stroke';
  }

  ticketStatusIcon(status: number): string {
    return SUPPORT_TICKET_STATUS_MAP[status]?.icon ?? 'fa-solid fa-folder-open';
  }

  ticketProgress(status: number): number {
    return this.STATUS_PROGRESS[status] ?? 0;
  }

  /** Left-border accent on the ticket card, keyed off priority. */
  ticketAccentClass(priority: number): string {
    switch (priority) {
      case 1:
        return 'is-high';
      case 3:
        return 'is-low';
      default:
        return 'is-medium';
    }
  }

  // ─────────── customer helpers ───────────

  localizeStatus(raw: string | null | undefined): string {
    if (!raw) return this.t('customers.table.unknownStatus');
    return resolveCustomerStatus(raw, this.lang.lang(), raw);
  }

  statusBadgeClass(raw: string | null | undefined): string {
    return customerStatusBadgeClass(raw);
  }

  consultationLabel(row: CustomerListItem): string {
    return this.t(
      row.isConsulted
        ? 'customers.consultation.badgeDone'
        : 'customers.consultation.badgePending',
    );
  }

  initials(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ─────────── formatting ───────────

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatShortDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  formatRelative(value: string | null | undefined): string {
    if (!value) return '';
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return '';
    const delta = Date.now() - ts;
    const day = 24 * 60 * 60 * 1000;
    if (delta < day) return this.t('dashboard.today');
    if (delta < 2 * day) return this.t('dashboard.yesterday');
    return this.formatDate(value);
  }

  trackByCustomerId = (_: number, r: CustomerListItem) => r.id;
  trackByTicketId = (_: number, r: SupportTicket) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
