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
  selector: 'app-employee-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-reports.component.html',
  styleUrl: './employee-reports.component.scss',
})
export class EmployeeReportsComponent {
  private lang = inject(LanguageService);

  period = 'last6Months';
  department = 'allDepartments';
  role = 'allRoles';

  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly departmentOptions = [
    'allDepartments', 'marketing', 'sales', 'support', 'development', 'hr',
  ];
  readonly roleOptions = ['allRoles', 'manager', 'senior', 'junior', 'intern'];

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
    { labelKey: 'reportAnalysis.employee.kpi.totalEmployees', value: '64', delta: '+4', deltaTone: 'success', icon: 'fa-solid fa-users', iconTone: 'primary' },
    { labelKey: 'reportAnalysis.employee.kpi.active', value: '58', delta: '+2', deltaTone: 'success', icon: 'fa-solid fa-user-check', iconTone: 'success' },
    { labelKey: 'reportAnalysis.employee.kpi.avgPerformance', value: '88%', delta: '+3.4%', deltaTone: 'success', icon: 'fa-solid fa-chart-line', iconTone: 'warning' },
    { labelKey: 'reportAnalysis.employee.kpi.attendance', value: '94%', delta: '-1.2%', deltaTone: 'danger', icon: 'fa-solid fa-calendar-check', iconTone: 'purple' },
    { labelKey: 'reportAnalysis.employee.kpi.hours', value: '9,820', delta: '+5.8%', deltaTone: 'success', icon: 'fa-solid fa-clock', iconTone: 'orange' },
  ];

  readonly performanceChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.employee.charts.performanceOverTime'), data: [78, 82, 80, 86, 88, 90] }],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth' as const, width: 3 },
    xaxis: { categories: this.monthLabels() },
    yaxis: { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%` } },
    grid: { borderColor: 'var(--border)' },
    markers: { size: 4 },
    dataLabels: { enabled: false },
  }));

  readonly topPerformersChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.employee.charts.score'), data: [95, 92, 88, 85, 81] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#10b981'],
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
    xaxis: { categories: ['أحمد محمد', 'سارة علي', 'محمد حسن', 'فاطمة عمر', 'يوسف خالد'] },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: true, formatter: (v: number) => `${v}%`, style: { colors: ['#fff'] } },
  }));

  readonly attendanceChart = computed(() => ({
    series: [85, 8, 7],
    chart: { type: 'donut' as const, height: 320 },
    labels: [
      this.t('reportAnalysis.employee.charts.present'),
      this.t('reportAnalysis.employee.charts.late'),
      this.t('reportAnalysis.employee.charts.absent'),
    ],
    colors: ['#10b981', '#f59e0b', '#ef4444'],
    legend: { position: 'bottom' as const },
    stroke: { width: 2 },
    dataLabels: { enabled: true },
  }));

  readonly tasksChart = computed(() => ({
    series: [{ name: this.t('reportAnalysis.employee.charts.tasks'), data: [42, 38, 35, 31, 27] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    colors: ['#7c3aed'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 6 } },
    xaxis: { categories: ['أحمد', 'سارة', 'محمد', 'فاطمة', 'يوسف'] },
    grid: { borderColor: 'var(--border)' },
    dataLabels: { enabled: false },
  }));
}
