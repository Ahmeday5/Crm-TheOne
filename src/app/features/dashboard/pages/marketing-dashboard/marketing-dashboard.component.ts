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
import { CampaignsService } from '../../../marketing-campaigns/services/campaigns.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  Campaign,
  CustomerListItem,
  DailyCustomersPoint,
  MarketingDashboardStats,
  SourcePerformanceItem,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MarketingService } from '../../services/marketing.service';

@Component({
  selector: 'app-marketing-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslatePipe, PageHeaderComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-dashboard.component.html',
  styleUrl: './marketing-dashboard.component.scss',
})
export class MarketingDashboardComponent {
  private readonly lang = inject(LanguageService);
  private readonly marketing = inject(MarketingService);
  private readonly customers = inject(CustomersService);
  private readonly campaigns = inject(CampaignsService);
  private readonly router = inject(Router);

  // ─────────── state ───────────
  readonly stats = signal<MarketingDashboardStats | null>(null);
  readonly sourcePerformance = signal<SourcePerformanceItem[]>([]);
  readonly daily = signal<DailyCustomersPoint[]>([]);
  readonly latestCustomers = signal<CustomerListItem[]>([]);
  readonly recentCampaigns = signal<Campaign[]>([]);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  // ─────────── chart options (rebuilt when language or data changes) ───────────

  /** Bars per platform — customers count + total budget side by side. */
  readonly platformChart = computed(() => {
    const items = this.sourcePerformance();
    return {
      series: [
        { name: this.t('dashboard.marketing.customers'), data: items.map((i) => i.customersCount) },
        { name: this.t('dashboard.marketing.budget'), data: items.map((i) => i.totalBudget) },
      ],
      chart: { type: 'bar' as const, height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      xaxis: { categories: items.map((i) => i.sourceName) },
      yaxis: [
        { seriesName: this.t('dashboard.marketing.customers'), title: { text: this.t('dashboard.marketing.customers') } },
        { seriesName: this.t('dashboard.marketing.budget'), opposite: true, title: { text: this.t('dashboard.marketing.budget') }, labels: { formatter: (v: number) => this.formatCurrency(v) } },
      ],
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
      colors: ['#0066cc', '#10b981'],
      dataLabels: { enabled: false },
      legend: { position: 'top' as const },
      grid: { borderColor: 'var(--border)' },
      tooltip: {
        shared: true,
        intersect: false,
        y: [
          { formatter: (v: number) => `${v}` },
          { formatter: (v: number) => this.formatCurrency(v) },
        ],
      },
    };
  });

  /** Daily line chart for the trailing 7 days. */
  readonly dailyChart = computed(() => {
    const points = this.daily();
    return {
      series: [{ name: this.t('dashboard.marketing.customers'), data: points.map((p) => p.count) }],
      chart: { type: 'area' as const, height: 320, toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
      xaxis: { categories: points.map((p) => this.formatShortDate(p.date)) },
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
      stroke: { curve: 'smooth' as const, width: 3 },
      colors: ['#0066cc'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
      },
      dataLabels: { enabled: false },
      grid: { borderColor: 'var(--border)' },
      tooltip: { x: { format: 'dd/MM/yyyy' } },
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      stats: this.marketing.statistics(),
      sources: this.marketing.sourcePerformance(),
      daily: this.marketing.last7Days(),
      latest: this.customers.list({ PageIndex: 1, PageSize: 10 }),
      campaigns: this.campaigns.list({ pageIndex: 1, pageSize: 10 }),
    }).subscribe({
      next: (res) => {
        this.stats.set(res.stats);
        this.sourcePerformance.set(res.sources ?? []);
        this.daily.set(res.daily ?? []);
        this.latestCustomers.set(res.latest.data ?? []);
        this.recentCampaigns.set(res.campaigns.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('dashboard.marketing.loadFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '0';
    return new Intl.NumberFormat(this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US').format(value);
  }

  formatShortDate(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { day: '2-digit', month: 'short' },
      );
    } catch {
      return iso;
    }
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

  statusBadgeClass(status: string | null | undefined): string {
    if (!status) return 'bg-secondary-subtle text-secondary';
    const s = status.toLowerCase();
    if (s.includes('active') || s.includes('نش')) return 'bg-success-subtle text-success';
    if (s.includes('paus') || s.includes('متوقف')) return 'bg-warning-subtle text-warning';
    if (s.includes('end') || s.includes('منته')) return 'bg-secondary-subtle text-secondary';
    return 'bg-primary-subtle text-primary';
  }

  goToLeads(): void {
    this.router.navigate(['/leads/marketing-leadsCustomer']);
  }

  goToCampaigns(): void {
    this.router.navigate(['/marketing-campaigns']);
  }

  goToAddLead(): void {
    this.router.navigate(['/leads/add-leadCustomer']);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
