import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
  SalesAnalysisStats,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MarketingService } from '../../../dashboard/services/marketing.service';
import { CampaignsService } from '../../../marketing-campaigns/services/campaigns.service';

type CustomerStatus = 'buyer' | 'nonBuyer';

interface CustomerRow {
  name: string;
  company: string;
  status: CustomerStatus;
  service: string;
  value: number;
  daysInPipeline: number;
  campaign: string;
  platform: string;
  assignee: string;
  date: string;
  /** Only populated when status === 'nonBuyer'. */
  lossReason?: string;
}

interface ReasonSlice {
  name: string;
  value: number;
}

@Component({
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-reports.component.html',
  styleUrl: './sales-reports.component.scss',
})
export class SalesReportsComponent {
  private readonly lang = inject(LanguageService);
  private readonly marketing = inject(MarketingService);
  private readonly campaignsApi = inject(CampaignsService);

  // ─────────── filters ───────────
  searchTerm = '';
  statusFilter: '' | CustomerStatus = '';
  platformFilter = '';

  // ─────────── server-driven state ───────────
  readonly stats = signal<SalesAnalysisStats | null>(null);
  readonly campaigns = signal<CampaignPerformanceRow[]>([]);
  readonly loadingStats = signal(true);
  readonly loadingCampaigns = signal(true);
  readonly loadError = signal<string | null>(null);

  // ─────────── mock data (customer list — no backend endpoint yet) ───────────
  readonly customers = signal<CustomerRow[]>([
    {
      name: 'أحمد محمد', company: 'شركة الحلول التقنية', status: 'buyer',
      service: 'برنامج محاسبي', value: 15000, daysInPipeline: 12,
      campaign: 'حملة الصيف الكبرى', platform: 'Facebook', assignee: 'عمر حسن',
      date: '2026-02-05',
    },
    {
      name: 'سارة علي', company: 'وكالة التسويق الرقمي', status: 'nonBuyer',
      service: 'نظام CRM', value: 25000, daysInPipeline: 8,
      campaign: 'حملة إطلاق المنتج', platform: 'Google Ads', assignee: 'فاطمة أحمد',
      date: '2026-02-03', lossReason: 'السعر مرتفع جداً',
    },
    {
      name: 'خالد حسن', company: 'مجموعة الابتكار', status: 'buyer',
      service: 'تطبيق جوال', value: 35000, daysInPipeline: 15,
      campaign: 'حملة الصيف الكبرى', platform: 'Instagram', assignee: 'عمر حسن',
      date: '2026-02-06',
    },
    {
      name: 'منى إبراهيم', company: 'شركة التجارة الإلكترونية', status: 'nonBuyer',
      service: 'موقع ويب', value: 18000, daysInPipeline: 10,
      campaign: 'حملة B2B', platform: 'LinkedIn', assignee: 'فاطمة أحمد',
      date: '2026-02-04', lossReason: 'اختار منافس آخر',
    },
    {
      name: 'يوسف سعيد', company: 'مكتب الاستشارات', status: 'buyer',
      service: 'برنامج محاسبي', value: 22000, daysInPipeline: 9,
      campaign: 'حملة الصيف الكبرى', platform: 'Facebook', assignee: 'عمر حسن',
      date: '2026-02-07',
    },
    {
      name: 'هند ناصر', company: 'استوديو التصميم', status: 'nonBuyer',
      service: 'تطبيق جوال', value: 28000, daysInPipeline: 14,
      campaign: 'محتوى فيديو', platform: 'TikTok', assignee: 'محمد علي',
      date: '2026-02-02', lossReason: 'الميزانية غير كافية',
    },
    {
      name: 'عبدالله الزهراني', company: 'متجر إلكتروني', status: 'buyer',
      service: 'موقع ويب', value: 18000, daysInPipeline: 7,
      campaign: 'حملة إطلاق المنتج', platform: 'Instagram', assignee: 'فاطمة أحمد',
      date: '2026-02-08',
    },
    {
      name: 'لمى الشهري', company: 'شركة العقارات', status: 'nonBuyer',
      service: 'نظام CRM', value: 10000, daysInPipeline: 11,
      campaign: 'حملة B2B', platform: 'LinkedIn', assignee: 'محمد علي',
      date: '2026-02-01', lossReason: 'لم يعد مهتماً',
    },
  ]);

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

  // ─────────── filtered customer list (mock) ───────────
  readonly filteredCustomers = computed(() => {
    const term = this.searchTerm.trim().toLowerCase();
    const status = this.statusFilter;
    const platform = this.platformFilter;
    return this.customers().filter((c) => {
      if (status && c.status !== status) return false;
      if (platform && c.platform !== platform) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.company.toLowerCase().includes(term) ||
        c.campaign.toLowerCase().includes(term)
      );
    });
  });

  readonly platforms = computed(() =>
    Array.from(new Set(this.customers().map((c) => c.platform))),
  );

  // ─────────── charts (still mock-derived for now) ───────────
  readonly reasonSlices = computed<ReasonSlice[]>(() => {
    const reasons: Record<string, number> = {};
    for (const c of this.customers()) {
      if (c.status !== 'nonBuyer' || !c.lossReason) continue;
      reasons[c.lossReason] = (reasons[c.lossReason] ?? 0) + 1;
    }
    return Object.entries(reasons).map(([name, value]) => ({ name, value }));
  });

  readonly reasonsChart = computed(() => {
    const slices = this.reasonSlices();
    return {
      series: slices.map((s) => s.value),
      labels: slices.map((s) => s.name),
      chart: { type: 'pie' as const, height: 320, fontFamily: 'inherit' },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'],
      legend: { position: 'bottom' as const },
      dataLabels: {
        enabled: true,
        formatter: (_val: number, opts: { seriesIndex: number; w: { config: { series: number[] } } }) => {
          const idx = opts.seriesIndex;
          const list = opts.w.config.series;
          return `${slices[idx]?.name ?? ''} (${list[idx]})`;
        },
      },
      stroke: { width: 2 },
    };
  });

  readonly platformChart = computed(() => {
    const buckets: Record<string, { buyers: number; nonBuyers: number }> = {};
    for (const c of this.customers()) {
      const b = (buckets[c.platform] ??= { buyers: 0, nonBuyers: 0 });
      if (c.status === 'buyer') b.buyers += 1;
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
    this.loadError.set(null);

    forkJoin({
      stats: this.marketing.salesStatistics(),
      campaigns: this.campaignsApi.performance(),
    }).subscribe({
      next: ({ stats, campaigns }) => {
        this.stats.set(stats);
        this.campaigns.set(campaigns ?? []);
        this.loadingStats.set(false);
        this.loadingCampaigns.set(false);
      },
      error: () => {
        this.loadingStats.set(false);
        this.loadingCampaigns.set(false);
        this.loadError.set(this.t('reportAnalysis.sales.loadFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US').format(value);
  }

  formatDate(iso: string): string {
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
    this.searchTerm = '';
    this.statusFilter = '';
    this.platformFilter = '';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
