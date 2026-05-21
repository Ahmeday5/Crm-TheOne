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
import { NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  CampaignPerformanceRow,
  CustomerListItem,
  SalesAnalysisStats,
} from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MarketingService } from '../../../dashboard/services/marketing.service';
import { SalesService } from '../../../dashboard/services/sales.service';
import { CustomersService } from '../../../leads/services/customers.service';
import { customerStatusKey } from '../../../leads/utils/customer-status.util';
import { CampaignsService } from '../../../marketing-campaigns/services/campaigns.service';

/** Two-way bound option for the status filter dropdown. */
type CustomerStatusFilter = '' | 'buyer' | 'nonBuyer';

interface ReasonSlice {
  name: string;
  value: number;
}

@Component({
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-reports.component.html',
  styleUrl: './sales-reports.component.scss',
})
export class SalesReportsComponent implements OnInit {
  private readonly lang = inject(LanguageService);
  private readonly marketing = inject(MarketingService);
  private readonly salesApi = inject(SalesService);
  private readonly customersApi = inject(CustomersService);
  private readonly campaignsApi = inject(CampaignsService);

  /** Caps the reasons chart slice count — past this we'd just be noise. */
  private readonly REASONS_CHART_LIMIT = 10;
  /** Theme-friendly palette cycled across the reasons donut slices. */
  private readonly REASONS_PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#ec4899', '#14b8a6',
    '#f97316', '#6366f1',
  ];

  /**
   * Server hard-caps `PageSize` for the leads endpoint, but the analysis
   * page wants the full Buyer / NotBuyer cohort in one view. We pull a
   * big-enough page so client-side filtering still gives a complete picture.
   * If the total ever exceeds this, the empty-state copy hints the user to
   * narrow via filters.
   */
  private readonly CUSTOMER_LIST_PAGE_SIZE = 500;

  // ─────────── filters (signal-backed so the computed re-runs) ───────────
  //
  // Plain class fields mutated by `[(ngModel)]` would NOT trigger the
  // `filteredCustomers` computed — `computed()` only re-evaluates when one
  // of the signals it read changes. We bind these via `[ngModel]` + an
  // explicit `(ngModelChange)` setter so every keystroke / select update
  // funnels through `.set()` and the table reacts.
  readonly searchTerm = signal('');
  readonly statusFilter = signal<CustomerStatusFilter>('');
  readonly platformFilter = signal('');

  // ─────────── server-driven state ───────────
  readonly stats = signal<SalesAnalysisStats | null>(null);
  readonly campaigns = signal<CampaignPerformanceRow[]>([]);
  readonly notBuyingReasons = signal<string[]>([]);
  /** Raw customer list straight from `Customers/getLeadCustomer`. */
  readonly customers = signal<CustomerListItem[]>([]);

  readonly loadingStats = signal(true);
  readonly loadingCampaigns = signal(true);
  readonly loadingReasons = signal(true);
  readonly loadingCustomers = signal(true);
  readonly loadError = signal<string | null>(null);

  // ─────────── KPI projection ───────────
  /** Flattens whatever the stats endpoint returned into the shape the template renders. */
  readonly totals = computed(() => {
    const s = this.stats();
    return {
      total: s?.totalCustomers ?? 0,
      buyers: s?.buyerCustomers ?? 0,
      nonBuyers: s?.notBuyerCustomers ?? 0,
      conversionRate: s?.conversionRate ?? 0,
    };
  });

  /**
   * Slice of `customers()` whose status canonicalises to Buyer or NotBuyer.
   * Done once here so every downstream computed (filter, platform chart,
   * counters) sees the same cohort and stays consistent.
   */
  readonly outcomeCustomers = computed(() =>
    this.customers().filter((c) => {
      const key = customerStatusKey(c.status);
      return key === 'buyer' || key === 'notBuyer';
    }),
  );

  /** Page-derived counts shown next to the filter chips. */
  readonly outcomeTotals = computed(() => {
    const list = this.outcomeCustomers();
    const buyers = list.filter((c) => customerStatusKey(c.status) === 'buyer').length;
    const nonBuyers = list.length - buyers;
    return { buyers, nonBuyers };
  });

  // ─────────── filtered customer list (real data) ───────────
  readonly filteredCustomers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const platform = this.platformFilter();
    return this.outcomeCustomers().filter((c) => {
      if (status) {
        const key = customerStatusKey(c.status);
        if (status === 'buyer' && key !== 'buyer') return false;
        if (status === 'nonBuyer' && key !== 'notBuyer') return false;
      }
      if (platform && (c.source ?? '') !== platform) return false;
      if (!term) return true;
      const haystack = [
        c.fullName,
        c.phone,
        c.campaignName,
        c.notBuyerReason,
        c.salesPersonName,
        ...(c.services ?? []).map((s) => s.name),
      ]
        .filter((v): v is string => !!v)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  /** Distinct, non-empty `source` values from the Buyer/NotBuyer cohort. */
  readonly platforms = computed(() => {
    const seen = new Set<string>();
    for (const c of this.outcomeCustomers()) {
      const s = (c.source ?? '').trim();
      if (s) seen.add(s);
    }
    return Array.from(seen);
  });

  // ─────────── reasons chart (from /Sales/NotBuyingReasons) ───────────
  /**
   * Group the raw reason strings by their normalized (trimmed) value,
   * sort by frequency descending, and cap at `REASONS_CHART_LIMIT`. If the
   * backend hands us 100 distinct one-off reasons, only the top 10 land
   * on the chart — the rest are summarised in a single "Other" slice so
   * the total stays accurate.
   */
  readonly reasonSlices = computed<ReasonSlice[]>(() => {
    const buckets = new Map<string, number>();
    for (const raw of this.notBuyingReasons()) {
      const name = (raw ?? '').trim();
      if (!name) continue;
      buckets.set(name, (buckets.get(name) ?? 0) + 1);
    }
    const sorted = Array.from(buckets, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= this.REASONS_CHART_LIMIT) return sorted;

    const head = sorted.slice(0, this.REASONS_CHART_LIMIT);
    const tail = sorted.slice(this.REASONS_CHART_LIMIT);
    const otherTotal = tail.reduce((sum, s) => sum + s.value, 0);
    return [
      ...head,
      { name: this.t('reportAnalysis.sales.charts.otherReasons'), value: otherTotal },
    ];
  });

  readonly reasonsChart = computed(() => {
    const slices = this.reasonSlices();
    const palette = this.REASONS_PALETTE;
    return {
      series: slices.map((s) => s.value),
      labels: slices.map((s) => s.name),
      chart: { type: 'donut' as const, height: 340, fontFamily: 'inherit' },
      colors: slices.map((_, i) => palette[i % palette.length]),
      legend: { position: 'bottom' as const, fontSize: '13px' },
      stroke: { width: 2 },
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: this.t('reportAnalysis.sales.charts.totalReasons'),
                fontSize: '13px',
                fontWeight: 600,
                formatter: (w: { globals: { seriesTotals: number[] } }) =>
                  String(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      tooltip: {
        y: { formatter: (val: number) => `${val} ${this.t('reportAnalysis.sales.charts.case')}` },
      },
    };
  });

  /** Per-source bar chart — buyers vs non-buyers (driven by real data). */
  readonly platformChart = computed(() => {
    const buckets: Record<string, { buyers: number; nonBuyers: number }> = {};
    for (const c of this.outcomeCustomers()) {
      const platform = (c.source ?? '—').trim() || '—';
      const b = (buckets[platform] ??= { buyers: 0, nonBuyers: 0 });
      if (customerStatusKey(c.status) === 'buyer') b.buyers += 1;
      else b.nonBuyers += 1;
    }
    const categories = Object.keys(buckets);
    return {
      series: [
        { name: this.t('reportAnalysis.sales.charts.buyers'), data: categories.map((p) => buckets[p].buyers) },
        { name: this.t('reportAnalysis.sales.charts.nonBuyers'), data: categories.map((p) => buckets[p].nonBuyers) },
      ],
      chart: { type: 'bar' as const, height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      xaxis: { categories },
      colors: ['#10b981', '#ef4444'],
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
      dataLabels: { enabled: false },
      legend: { position: 'bottom' as const },
      grid: { borderColor: 'var(--border)' },
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loadingStats.set(true);
    this.loadingCampaigns.set(true);
    this.loadingReasons.set(true);
    this.loadingCustomers.set(true);
    this.loadError.set(null);

    forkJoin({
      stats: this.marketing.salesStatistics(),
      campaigns: this.campaignsApi.performance(),
      reasons: this.salesApi.notBuyingReasons(),
      customers: this.customersApi.list({
        PageIndex: 1,
        PageSize: this.CUSTOMER_LIST_PAGE_SIZE,
      }),
    }).subscribe({
      next: ({ stats, campaigns, reasons, customers }) => {
        this.stats.set(stats);
        this.campaigns.set(campaigns ?? []);
        this.notBuyingReasons.set(reasons ?? []);
        this.customers.set(customers?.data ?? []);
        this.loadingStats.set(false);
        this.loadingCampaigns.set(false);
        this.loadingReasons.set(false);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.loadingStats.set(false);
        this.loadingCampaigns.set(false);
        this.loadingReasons.set(false);
        this.loadingCustomers.set(false);
        this.loadError.set(this.t('reportAnalysis.sales.loadFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  /** True when the canonical status of `c` is "buyer". */
  isBuyer(c: CustomerListItem): boolean {
    return customerStatusKey(c.status) === 'buyer';
  }

  /** Two-letter initials for the avatar tile in each customer card. */
  initials(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US').format(value);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: '2-digit' },
      );
    } catch {
      return iso;
    }
  }

  conversionTone(rate: number): string {
    if (rate >= 50) return 'text-success';
    if (rate >= 25) return 'text-warning';
    return 'text-orange';
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.platformFilter.set('');
  }

  trackById = (_: number, c: CustomerListItem) => c.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
