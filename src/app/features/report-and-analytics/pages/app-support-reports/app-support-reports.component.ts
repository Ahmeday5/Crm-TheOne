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
  iconTone: 'primary' | 'success' | 'warning' | 'purple' | 'orange' | 'danger';
}

@Component({
  selector: 'app-app-support-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-support-reports.component.html',
  styleUrl: './app-support-reports.component.scss',
})
export class AppSupportReportsComponent {
  private lang = inject(LanguageService);

  period = 'last6Months';
  team = 'allTeams';
  priority = 'allPriorities';

  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly teamOptions = ['allTeams'];
  readonly priorityOptions = ['allPriorities'];

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
    { labelKey: 'reportAnalysis.appSupport.kpi.openTickets', value: '38', delta: '-12%', deltaTone: 'success', icon: 'fa-solid fa-ticket', iconTone: 'orange' },
    { labelKey: 'reportAnalysis.appSupport.kpi.avgResponse', value: '24m', delta: '-8m', deltaTone: 'success', icon: 'fa-solid fa-stopwatch', iconTone: 'primary' },
    { labelKey: 'reportAnalysis.appSupport.kpi.avgResolution', value: '4.2h', delta: '+0.3h', deltaTone: 'danger', icon: 'fa-solid fa-clock', iconTone: 'warning' },
    { labelKey: 'reportAnalysis.appSupport.kpi.satisfaction', value: '4.6/5', delta: '+0.2', deltaTone: 'success', icon: 'fa-solid fa-star', iconTone: 'success' },
    { labelKey: 'reportAnalysis.appSupport.kpi.resolutionRate', value: '92%', delta: '+3%', deltaTone: 'success', icon: 'fa-solid fa-check-double', iconTone: 'purple' },
  ];

  readonly trendChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.appSupport.charts.opened'), data: [62, 75, 68, 80, 72, 65] },
      { name: this.t('reportAnalysis.appSupport.charts.closed'), data: [55, 70, 72, 78, 76, 70] },
    ],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    colors: ['#ef4444', '#10b981'],
    stroke: { curve: 'smooth' as const, width: 3 },
    xaxis: { categories: this.monthLabels() },
    grid: { borderColor: 'var(--border)' },
    legend: { position: 'bottom' as const },
    markers: { size: 4 },
    dataLabels: { enabled: false },
  }));

  readonly priorityChart = computed(() => ({
    series: [6, 12, 14, 6],
    chart: { type: 'donut' as const, height: 320 },
    labels: [
      this.t('reportAnalysis.panel.priorities.urgent'),
      this.t('reportAnalysis.panel.priorities.high'),
      this.t('reportAnalysis.panel.priorities.medium'),
      this.t('reportAnalysis.panel.priorities.low'),
    ],
    colors: ['#ef4444', '#f59e0b', '#eab308', '#94a3b8'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));

  readonly categoryChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.appSupport.kpi.openTickets'), data: [16, 9, 5, 4, 4] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#0066cc'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    xaxis: {
      categories: [
        this.t('reportAnalysis.appSupport.categories.bug'),
        this.t('reportAnalysis.appSupport.categories.howTo'),
        this.t('reportAnalysis.appSupport.categories.billing'),
        this.t('reportAnalysis.appSupport.categories.feature'),
        this.t('reportAnalysis.appSupport.categories.other'),
      ],
    },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, style: { colors: ['#fff'] } },
  }));

  readonly satisfactionChart = computed(() => ({
    series: [62, 24, 9, 5],
    chart: { type: 'donut' as const, height: 320 },
    labels: [
      this.t('reportAnalysis.appSupport.satisfactionLevels.excellent'),
      this.t('reportAnalysis.appSupport.satisfactionLevels.good'),
      this.t('reportAnalysis.appSupport.satisfactionLevels.ok'),
      this.t('reportAnalysis.appSupport.satisfactionLevels.bad'),
    ],
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));
}
