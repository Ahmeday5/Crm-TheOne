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
import { forkJoin } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CustomerListItem,
  SalesDashboardStats,
  SalesStatusCount,
} from '../../../../shared/models';
import { CustomersService } from '../../../leads/services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../../leads/utils/customer-status.util';
import { SalesService } from '../../services/sales.service';

/**
 * Sales rep / admin dashboard.
 *
 * Three live data sources:
 *   - `GET /Sales/SalesDashboardStatistics`     KPI strip
 *   - `GET /Sales/SalesCustomerStatusCount`     pipeline chart
 *   - `GET /Customers/getSalesCustomers`        "my leads" preview (top N)
 *
 * Static widgets:
 *   - Quick actions — buttons that route into the matching feature pages.
 *
 * Deliberately removed: the previous mocked "weekly performance" chart and
 * "daily schedule" widget — the user asked us not to render fake data.
 * The "monthly summary" card stays as a small fixed footer because it's a
 * non-numeric brand strip, not a data widget.
 */
@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    TranslatePipe,
    PageHeaderComponent,
    LoadErrorComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.scss',
})
export class SalesDashboardComponent implements OnInit {
  private readonly salesApi = inject(SalesService);
  private readonly customersApi = inject(CustomersService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  /** Number of rows shown in the "my leads" preview card. */
  private readonly MY_LEADS_PREVIEW_LIMIT = 5;

  /** Theme-friendly palette cycled across pipeline buckets. */
  private readonly PIPELINE_PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#ec4899', '#14b8a6',
    '#f97316', '#6366f1',
  ];

  readonly stats = signal<SalesDashboardStats | null>(null);
  readonly pipeline = signal<SalesStatusCount[]>([]);
  readonly myLeads = signal<CustomerListItem[]>([]);

  readonly loadingStats = signal(true);
  readonly loadingPipeline = signal(true);
  readonly loadingLeads = signal(true);
  readonly loadError = signal<string | null>(null);

  /** Empty-safe view-model for the KPI strip. */
  readonly kpis = computed(() => {
    const s = this.stats();
    return {
      buyerCustomers: s?.buyerCustomers ?? 0,
      callsToday: s?.callsToday ?? 0,
      upcomingFollowUps: s?.upcomingFollowUps ?? 0,
      overdueFollowUps: s?.overdueFollowUps ?? 0,
      transferredToSupport: s?.transferredToSupport ?? 0,
      receivedFromMarketing: s?.receivedFromMarketing ?? 0,
    };
  });

  /**
   * ApexCharts options for the pipeline. Built on demand from the latest
   * `pipeline()` value — the template only mounts `<apx-chart>` after the
   * data has landed, which sidesteps the ng-apexcharts re-init quirk that
   * leaves the canvas blank when initial inputs are empty.
   *
   * Horizontal bars: status names sit on the Y axis where the long Arabic
   * labels read cleanly without crowding the X axis.
   */
  readonly pipelineChart = computed(() => {
    const rows = this.pipeline();
    const palette = this.PIPELINE_PALETTE;
    const categories = rows.map((r) => this.localizeStatus(r.statusName));
    const counts = rows.map((r) => r.count);
    return {
      series: [
        {
          name: this.t('dashboard.sales.pipelineSeries'),
          data: counts,
        },
      ],
      chart: {
        type: 'bar' as const,
        height: 360,
        fontFamily: 'inherit',
        toolbar: { show: false },
        animations: { easing: 'easeinout' as const, speed: 400 },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 6,
          barHeight: '65%',
          dataLabels: { position: 'top' as const },
        },
      },
      colors: rows.map((_, i) => palette[i % palette.length]),
      dataLabels: {
        enabled: true,
        textAnchor: 'start' as const,
        offsetX: 8,
        formatter: (val: number) => String(val),
        style: { fontSize: '12px', fontWeight: 600, colors: ['#0f172a'] },
      },
      xaxis: {
        categories,
        labels: { style: { fontSize: '12px', colors: '#475569' } },
      },
      yaxis: {
        labels: { style: { fontSize: '12px', colors: '#475569' } },
      },
      legend: { show: false },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      tooltip: {
        y: { formatter: (val: number) => `${val} ${this.t('dashboard.sales.customer')}` },
      },
    };
  });

  /** True when the pipeline has at least one bucket. */
  readonly hasPipeline = computed(() => this.pipeline().length > 0);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loadingStats.set(true);
    this.loadingPipeline.set(true);
    this.loadingLeads.set(true);
    this.loadError.set(null);

    // KPI + pipeline are mutually independent; loading them together keeps
    // the page coherent (no jumpy partial paint).
    forkJoin({
      stats: this.salesApi.dashboardStatistics(),
      pipeline: this.salesApi.customerStatusCount(),
      leads: this.customersApi.listForSales({
        PageIndex: 1,
        PageSize: this.MY_LEADS_PREVIEW_LIMIT,
      }),
    }).subscribe({
      next: ({ stats, pipeline, leads }) => {
        this.stats.set(stats);
        this.pipeline.set(pipeline ?? []);
        this.myLeads.set(leads?.data ?? []);
        this.loadingStats.set(false);
        this.loadingPipeline.set(false);
        this.loadingLeads.set(false);
      },
      error: () => {
        this.loadingStats.set(false);
        this.loadingPipeline.set(false);
        this.loadingLeads.set(false);
        this.loadError.set(this.t('dashboard.sales.loadFailed'));
      },
    });
  }

  // ─────────── quick actions ───────────

  goToCallClient(): void {
    this.router.navigate(['/leads/sales-leadsCustomer']);
  }
  goToUpdateStatus(): void {
    this.router.navigate(['/leads/sales-leadsCustomer']);
  }
  goToCreateOffer(): void {
    this.router.navigate(['/price-offers']);
  }
  goToScheduleMeeting(): void {
    this.router.navigate(['/schedule']);
  }
  goToCreateContract(): void {
    this.router.navigate(['/contracts-management']);
  }

  // ─────────── helpers ───────────

  /** Localised status label — handles English enum codes from this endpoint. */
  localizeStatus(raw: string | null | undefined): string {
    if (!raw) return this.t('customers.table.unknownStatus');
    return resolveCustomerStatus(raw, this.lang.lang(), raw);
  }

  statusBadgeClass(raw: string | null | undefined): string {
    return customerStatusBadgeClass(raw);
  }

  formatRelativeDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return '';
    const delta = Date.now() - ts;
    const day = 24 * 60 * 60 * 1000;
    if (delta < day) return this.t('dashboard.today');
    if (delta < 2 * day) return this.t('dashboard.yesterday');
    const days = Math.floor(delta / day);
    return this.t('dashboard.sales.daysAgo').replace('{n}', String(days));
  }

  trackById = (_: number, r: CustomerListItem) => r.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
