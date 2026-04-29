import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface KpiCard {
  labelKey: string;
  value: string;
  delta: string;
  deltaTone: 'success' | 'danger';
  icon: string;
  iconTone: 'primary' | 'success' | 'warning' | 'purple' | 'orange';
}

@Component({
  selector: 'app-marketing-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-reports.component.html',
  styleUrl: './marketing-reports.component.scss',
})
export class MarketingReportsComponent {
  private lang = inject(LanguageService);

  period = 'last6Months';
  channel = 'allChannels';
  campaign = 'allCampaigns';

  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly channelOptions = ['allChannels', 'facebook', 'google', 'instagram', 'email', 'organic'];
  readonly campaignOptions = ['allCampaigns'];

  private monthLabels = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun'].map((k) =>
      resolveKey(d, `dashboard.months.${k}`),
    );
  });
  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }

  readonly kpis: KpiCard[] = [
    { labelKey: 'reportAnalysis.marketing.kpi.totalLeads', value: '1,248', delta: '+15.2%', deltaTone: 'success', icon: 'fa-solid fa-users', iconTone: 'primary' },
    { labelKey: 'reportAnalysis.marketing.kpi.costPerLead', value: '42.5', delta: '-6.4%', deltaTone: 'success', icon: 'fa-solid fa-coins', iconTone: 'warning' },
    { labelKey: 'reportAnalysis.marketing.kpi.roi', value: '3.2x', delta: '+0.4x', deltaTone: 'success', icon: 'fa-solid fa-arrow-trend-up', iconTone: 'success' },
    { labelKey: 'reportAnalysis.marketing.kpi.activeCampaigns', value: '14', delta: '+2', deltaTone: 'success', icon: 'fa-solid fa-bullhorn', iconTone: 'orange' },
    { labelKey: 'reportAnalysis.marketing.kpi.conversion', value: '12.8%', delta: '+1.7%', deltaTone: 'success', icon: 'fa-solid fa-percent', iconTone: 'purple' },
  ];

  readonly leadsBySourceChart = computed(() => ({
    series: [450, 320, 280, 120, 78],
    chart: { type: 'donut' as const, height: 320 },
    labels: ['facebook', 'google', 'instagram', 'email', 'organic'].map((c) =>
      this.t('reportAnalysis.marketing.filters.' + c),
    ),
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#7c3aed', '#0ea5e9'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));

  readonly campaignPerfChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.marketing.charts.spend'), data: [12000, 18000, 15000, 22000, 20000] },
      { name: this.t('reportAnalysis.marketing.charts.revenue'), data: [38000, 56000, 47000, 72000, 68000] },
    ],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#f59e0b', '#10b981'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
    xaxis: { categories: ['Campaign A', 'Campaign B', 'Campaign C', 'Campaign D', 'Campaign E'] },
    yaxis: { labels: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`) } },
    grid: { borderColor: 'var(--border)' },
    legend: { position: 'bottom' as const },
    dataLabels: { enabled: false },
  }));

  readonly funnelChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.marketing.charts.funnel'), data: [12000, 4800, 1248, 540, 168] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#3b82f6'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, distributed: true } },
    xaxis: {
      categories: [
        this.t('reportAnalysis.marketing.funnelStages.impressions'),
        this.t('reportAnalysis.marketing.funnelStages.clicks'),
        this.t('reportAnalysis.marketing.funnelStages.leads'),
        this.t('reportAnalysis.marketing.funnelStages.qualified'),
        this.t('reportAnalysis.marketing.funnelStages.customers'),
      ],
    },
    fill: { colors: ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444'] },
    legend: { show: false },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, style: { colors: ['#fff'] } },
  }));

  readonly roiChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.marketing.kpi.roi'), data: [2.1, 2.4, 2.8, 3.0, 3.2, 3.5] }],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    colors: ['#10b981'],
    stroke: { curve: 'smooth' as const, width: 3 },
    xaxis: { categories: this.monthLabels() },
    yaxis: { labels: { formatter: (v: number) => `${v}x` } },
    grid: { borderColor: 'var(--border)' },
    markers: { size: 4 },
    dataLabels: { enabled: false },
  }));
}
