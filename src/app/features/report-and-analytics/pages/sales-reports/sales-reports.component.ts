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
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-reports.component.html',
  styleUrl: './sales-reports.component.scss',
})
export class SalesReportsComponent {
  private lang = inject(LanguageService);

  period = 'last6Months';
  team = 'allTeams';
  product = 'allProducts';

  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly teamOptions = ['allTeams'];
  readonly productOptions = ['allProducts'];

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
    { labelKey: 'reportAnalysis.sales.kpi.revenue', value: '1.18M', delta: '+22.4%', deltaTone: 'success', icon: 'fa-solid fa-dollar-sign', iconTone: 'warning' },
    { labelKey: 'reportAnalysis.sales.kpi.deals', value: '142', delta: '+18', deltaTone: 'success', icon: 'fa-solid fa-handshake', iconTone: 'success' },
    { labelKey: 'reportAnalysis.sales.kpi.avgDeal', value: '8,310', delta: '+5.2%', deltaTone: 'success', icon: 'fa-solid fa-receipt', iconTone: 'primary' },
    { labelKey: 'reportAnalysis.sales.kpi.winRate', value: '42%', delta: '+3.8%', deltaTone: 'success', icon: 'fa-solid fa-trophy', iconTone: 'orange' },
    { labelKey: 'reportAnalysis.sales.kpi.pipeline', value: '2.4M', delta: '-1.5%', deltaTone: 'danger', icon: 'fa-solid fa-chart-line', iconTone: 'purple' },
  ];

  readonly revenueByMonthChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.sales.charts.revenue'), data: [120000, 145000, 165000, 195000, 175000, 225000] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#0066cc'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
    xaxis: { categories: this.monthLabels() },
    yaxis: { labels: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`) } },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: false },
  }));

  readonly dealsByRepChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.sales.charts.deals'), data: [42, 38, 31, 24, 18] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#10b981'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    xaxis: { categories: ['Khalid', 'Sara', 'Omar', 'Layla', 'Nora'] },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, style: { colors: ['#fff'] } },
  }));

  readonly pipelineChart = computed(() => ({
    series: [120, 85, 60, 40, 23],
    chart: { type: 'donut' as const, height: 320 },
    labels: [
      this.t('reportAnalysis.panel.stages.new'),
      this.t('reportAnalysis.panel.stages.contact'),
      this.t('reportAnalysis.panel.stages.quotation'),
      this.t('reportAnalysis.panel.stages.negotiation'),
      this.t('reportAnalysis.panel.stages.won'),
    ],
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));

  readonly topCustomersChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.sales.charts.revenue'), data: [180000, 145000, 120000, 95000, 72000] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#7c3aed'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    xaxis: {
      categories: ['ABC Corp', 'Tech Hub', 'Global Trade', 'Nova LLC', 'Prime Co'],
      labels: { formatter: (v: string) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}K` : v) },
    },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, formatter: (v: number) => `${(v / 1000).toFixed(0)}K`, style: { colors: ['#fff'] } },
  }));
}
