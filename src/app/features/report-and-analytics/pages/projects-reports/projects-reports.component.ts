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
  suffixKey?: string;
}

@Component({
  selector: 'app-projects-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-reports.component.html',
  styleUrl: './projects-reports.component.scss',
})
export class ProjectsReportsComponent {
  private lang = inject(LanguageService);

  period = 'last6Months';
  status = 'allStatuses';
  manager = 'allManagers';

  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly statusOptions = ['allStatuses', 'active', 'onHold', 'completed', 'delayed'];
  readonly managerOptions = ['allManagers'];

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
    { labelKey: 'reportAnalysis.projects.kpi.active', value: '24', delta: '+3', deltaTone: 'success', icon: 'fa-solid fa-folder-open', iconTone: 'primary' },
    { labelKey: 'reportAnalysis.projects.kpi.completed', value: '47', delta: '+8', deltaTone: 'success', icon: 'fa-solid fa-check-circle', iconTone: 'success' },
    { labelKey: 'reportAnalysis.projects.kpi.onTime', value: '88%', delta: '+4%', deltaTone: 'success', icon: 'fa-solid fa-bullseye', iconTone: 'warning' },
    { labelKey: 'reportAnalysis.projects.kpi.avgDuration', value: '42', delta: '-3', deltaTone: 'success', icon: 'fa-solid fa-hourglass-half', iconTone: 'orange', suffixKey: 'reportAnalysis.projects.kpi.days' },
    { labelKey: 'reportAnalysis.projects.kpi.utilization', value: '78%', delta: '+2%', deltaTone: 'success', icon: 'fa-solid fa-people-group', iconTone: 'purple' },
  ];

  readonly statusChart = computed(() => ({
    series: [24, 5, 47, 6],
    chart: { type: 'donut' as const, height: 320 },
    labels: [
      this.t('reportAnalysis.projects.filters.active'),
      this.t('reportAnalysis.projects.filters.onHold'),
      this.t('reportAnalysis.projects.filters.completed'),
      this.t('reportAnalysis.projects.filters.delayed'),
    ],
    colors: ['#3b82f6', '#94a3b8', '#10b981', '#ef4444'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));

  readonly completionChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.projects.charts.completed'), data: [5, 8, 6, 9, 11, 8] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#10b981'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
    xaxis: { categories: this.monthLabels() },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: false },
  }));

  readonly workloadChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.projects.filters.active'), data: [6, 5, 4, 5, 4] },
      { name: this.t('reportAnalysis.projects.charts.completed'), data: [12, 9, 11, 8, 7] },
    ],
    chart: { type: 'bar' as const, height: 320, stacked: true, toolbar: { show: false } },
    colors: ['#3b82f6', '#10b981'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    xaxis: { categories: ['Khalid', 'Sara', 'Omar', 'Layla', 'Nora'] },
    grid: { borderColor: 'var(--border)' },
    legend: { position: 'bottom' as const },
    dataLabels: { enabled: false },
  }));

  readonly milestonesChart = computed(() => ({
    series: [
      { name: this.t('reportAnalysis.projects.charts.completed'), data: [8, 10, 12, 9, 14] },
      { name: this.t('reportAnalysis.projects.charts.inProgress'), data: [3, 5, 4, 6, 5] },
      { name: this.t('reportAnalysis.projects.charts.upcoming'), data: [2, 1, 3, 2, 2] },
    ],
    chart: { type: 'bar' as const, height: 320, stacked: true, toolbar: { show: false } },
    colors: ['#10b981', '#f59e0b', '#94a3b8'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
    xaxis: { categories: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] },
    grid: { borderColor: 'var(--border)' },
    legend: { position: 'bottom' as const },
    dataLabels: { enabled: false },
  }));
}
