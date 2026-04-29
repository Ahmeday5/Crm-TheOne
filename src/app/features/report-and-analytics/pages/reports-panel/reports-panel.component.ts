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
  selector: 'app-reports-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-panel.component.html',
  styleUrl: './reports-panel.component.scss',
})
export class ReportsPanelComponent {
  private lang = inject(LanguageService);

  /** Filter state — wired with [(ngModel)]; values are translation keys. */
  period = 'last6Months';
  team = 'allTeams';
  service = 'allServices';

  readonly periodOptions = [
    'last30Days',
    'last3Months',
    'last6Months',
    'lastYear',
  ];
  readonly teamOptions = ['allTeams', 'marketingTeam', 'salesTeam', 'supportTeam'];
  readonly serviceOptions = ['allServices', 'consulting', 'development', 'support'];

  /** Translated month labels for chart x-axes — recomputes on language toggle. */
  private monthLabels = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun'].map((k) =>
      resolveKey(d, `dashboard.months.${k}`),
    );
  });

  /** Static-ish translated label getter. */
  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }

  readonly kpis: KpiCard[] = [
    {
      labelKey: 'reportAnalysis.panel.kpi.totalLeads',
      value: '328',
      delta: '+12.5%',
      deltaTone: 'success',
      icon: 'fa-solid fa-users',
      iconTone: 'primary',
    },
    {
      labelKey: 'reportAnalysis.panel.kpi.conversionRate',
      value: '35.4%',
      delta: '+5.2%',
      deltaTone: 'success',
      icon: 'fa-solid fa-arrow-trend-up',
      iconTone: 'success',
    },
    {
      labelKey: 'reportAnalysis.panel.kpi.totalRevenue',
      value: '1.03M',
      delta: '+18.3%',
      deltaTone: 'success',
      icon: 'fa-solid fa-dollar-sign',
      iconTone: 'warning',
    },
    {
      labelKey: 'reportAnalysis.panel.kpi.activeProjects',
      value: '24',
      delta: '-3.1%',
      deltaTone: 'danger',
      icon: 'fa-solid fa-folder-open',
      iconTone: 'purple',
    },
    {
      labelKey: 'reportAnalysis.panel.kpi.openTickets',
      value: '18',
      delta: '-8.5%',
      deltaTone: 'danger',
      icon: 'fa-solid fa-ticket',
      iconTone: 'orange',
    },
  ];

  /** ───────── Charts (ApexCharts options) — computed so language switches re-render. */

  readonly leadsLineChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.panel.charts.totalLeads'), data: [50, 65, 55, 80, 70, 95] },
      { name: this.t('reportAnalysis.panel.charts.conversions'), data: [12, 15, 18, 22, 20, 28] },
    ],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    colors: ['#3b82f6', '#10b981'],
    stroke: { curve: 'smooth' as const, width: 3 },
    xaxis: { categories: this.monthLabels() },
    yaxis: { min: 0 },
    legend: { position: 'bottom' as const },
    grid: { borderColor: 'var(--border)' },
    markers: { size: 4 },
    dataLabels: { enabled: false },
  }));

  readonly revenueBarChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.panel.charts.revenue'), data: [120000, 145000, 165000, 195000, 175000, 225000] },
    ],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#10b981'],
    plotOptions: {
      bar: { columnWidth: '55%', borderRadius: 6 },
    },
    xaxis: { categories: this.monthLabels() },
    yaxis: { labels: { formatter: (v: number) => this.formatThousands(v) } },
    dataLabels: { enabled: false },
    grid: { borderColor: 'var(--border)' },
    tooltip: { y: { formatter: (v: number) => `${this.formatThousands(v)} ${this.t('reportAnalysis.panel.kpi.currency')}` } },
  }));

  readonly dealsPieChart = computed(() => ({
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
    dataLabels: { enabled: true },
    stroke: { width: 2 },
  }));

  readonly ticketsBarChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.panel.kpi.openTickets'), data: [3, 5, 7, 3] },
    ],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#0066cc'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        distributed: true,
      },
    },
    xaxis: {
      categories: [
        this.t('reportAnalysis.panel.priorities.urgent'),
        this.t('reportAnalysis.panel.priorities.high'),
        this.t('reportAnalysis.panel.priorities.medium'),
        this.t('reportAnalysis.panel.priorities.low'),
      ],
    },
    legend: { show: false },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, style: { colors: ['#fff'] } },
    fill: { colors: ['#ef4444', '#f59e0b', '#eab308', '#94a3b8'] },
  }));

  private formatThousands(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  }
}
