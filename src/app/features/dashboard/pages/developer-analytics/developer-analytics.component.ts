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

import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  ExportColumn,
  TableExportService,
} from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  DeveloperAnalyticsAll,
  DeveloperStatRow,
} from '../../../../shared/models';
import {
  DeveloperAnalyticsService,
} from '../../services/developer-analytics.service';

/**
 * Period values sent to the API — must match the backend `AnalyticsPeriod`
 * enum Description strings exactly (backend uses DescriptionEnumConverter).
 */
const PERIOD_OPTIONS = [
  { value: '', i18nKey: 'dashboard.devAnalytics.filters.allTime' },
  { value: 'الأسبوع الحالي', i18nKey: 'dashboard.devAnalytics.filters.thisWeek' },
  { value: 'الشهر الحالي', i18nKey: 'dashboard.devAnalytics.filters.thisMonth' },
  { value: 'الربع الحالي', i18nKey: 'dashboard.devAnalytics.filters.thisQuarter' },
  { value: 'نصف السنة', i18nKey: 'dashboard.devAnalytics.filters.halfYear' },
  { value: 'السنة الحالية', i18nKey: 'dashboard.devAnalytics.filters.thisYear' },
] as const;

@Component({
  selector: 'app-developer-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgApexchartsModule,
    TranslatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './developer-analytics.component.html',
  styleUrl: './developer-analytics.component.scss',
})
export class DeveloperAnalyticsComponent implements OnInit {
  private readonly analytics = inject(DeveloperAnalyticsService);
  private readonly exporter = inject(TableExportService);
  private readonly toast = inject(ToastService);
  protected readonly language = inject(LanguageService);

  // ── raw server data (single endpoint) ──
  private readonly rawData = signal<DeveloperAnalyticsAll | null>(null);
  readonly loading = signal(false);

  // ── derived slices ──
  readonly summary = computed(() => this.rawData()?.summary ?? null);
  private readonly allStats = computed(() => this.rawData()?.developerStats ?? []);
  private readonly charts = computed(() => this.rawData()?.charts ?? null);
  private readonly bugs = computed(() => this.rawData()?.bugAnalytics ?? null);

  // ── developer / project options — populated from the initial unfiltered load
  //    and kept stable so the dropdowns don't shrink when filters are active ──
  private optionsLoaded = false;
  private readonly devOptionsList = signal<{ id: string; name: string }[]>([]);
  private readonly projOptionsList = signal<{ id: number; name: string }[]>([]);

  readonly developerOptions = this.devOptionsList.asReadonly();
  readonly projectOptions = this.projOptionsList.asReadonly();

  // ── period options (matches backend AnalyticsPeriod enum descriptions) ──
  readonly periodOptions = PERIOD_OPTIONS;

  // ── server-side filter state ──
  readonly period = signal<string>('');
  readonly developerFilter = signal<string>('');
  readonly projectFilter = signal<number | null>(null);

  /** Filtered stats table — server already filters; keep as-is. */
  readonly stats = computed(() => this.allStats());

  // ── KPI helpers ──
  readonly openBugs = computed(() => this.summary()?.openBugs ?? 0);

  // ── Chart 1: task completion over time ──
  readonly completionChart = computed<Record<string, unknown>>(() => {
    const pts = this.charts()?.taskCompletionOverTime ?? [];
    return {
      series: [
        {
          name: this.t('dashboard.devAnalytics.charts.completed'),
          data: pts.map((p) => p.completed),
        },
        {
          name: this.t('dashboard.devAnalytics.charts.pending'),
          data: pts.map((p) => p.pending),
        },
      ],
      chart: { type: 'line', height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 4 },
      dataLabels: { enabled: false },
      xaxis: { categories: pts.map((p) => p.day) },
      colors: ['#10b981', '#f59e0b'],
      legend: { position: 'bottom' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  // ── Chart 2: projects progress ──
  readonly progressChart = computed<Record<string, unknown>>(() => {
    const pts = this.charts()?.projectsProgress ?? [];
    return {
      series: [
        {
          name: this.t('dashboard.devAnalytics.charts.progress'),
          data: pts.map((p) => p.progress),
        },
      ],
      chart: { type: 'bar', height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', distributed: true } },
      dataLabels: { enabled: true, formatter: (v: number) => `${v}%` },
      xaxis: { categories: pts.map((p) => p.projectName) },
      yaxis: { max: 100 },
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9'],
      legend: { show: false },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  // ── Chart 3: monthly open vs resolved bugs ──
  readonly monthlyBugsChart = computed<Record<string, unknown>>(() => {
    const pts = this.bugs()?.monthlyOpenVsResolved ?? [];
    return {
      series: [
        { name: this.t('dashboard.devAnalytics.charts.open'), data: pts.map((p) => p.open) },
        { name: this.t('dashboard.devAnalytics.charts.resolved'), data: pts.map((p) => p.resolved) },
      ],
      chart: { type: 'bar', height: 320, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: pts.map((p) => p.month) },
      colors: ['#ef4444', '#10b981'],
      legend: { position: 'bottom' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  // ── Chart 4: bug distribution (donut) ──
  readonly bugDistributionChart = computed<Record<string, unknown>>(() => {
    const pts = this.bugs()?.distributionByProject ?? [];

    if (pts.length === 0) {
      return {
        series: [1],
        chart: { type: 'donut', height: 320, fontFamily: 'inherit' },
        labels: [this.t('dashboard.devAnalytics.charts.noData')],
        colors: ['#e5e7eb'],
        legend: { position: 'bottom' },
        dataLabels: { enabled: false },
      };
    }

    return {
      series: pts.map(
        (p) => p.count ?? p.bugCount ?? (p.openBugs ?? 0) + (p.resolvedBugs ?? 0),
      ),
      chart: { type: 'donut', height: 320, fontFamily: 'inherit' },
      labels: pts.map((p) => p.projectName),
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.analytics
      .all({
        Period: this.period() || undefined,
        DeveloperId: this.developerFilter() || undefined,
        ProjectId: this.projectFilter() ?? undefined,
      })
      .subscribe({
        next: (data) => {
          this.rawData.set(data);
          this.loading.set(false);

          // Populate filter dropdowns from the first (unfiltered) response so they
          // stay stable even after the user applies a filter.
          if (!this.optionsLoaded) {
            this.devOptionsList.set(
              (data.developerStats ?? []).map((s) => ({ id: s.developerId, name: s.fullName })),
            );
            this.projOptionsList.set(
              (data.charts?.projectsProgress ?? []).map((p) => ({
                id: p.projectId,
                name: p.projectName,
              })),
            );
            this.optionsLoaded = true;
          }
        },
        error: () => {
          this.rawData.set(null);
          this.loading.set(false);
        },
      });
  }

  // ── filter handlers ──

  onPeriod(value: string): void {
    this.period.set(value);
    this.reload();
  }

  onDeveloper(value: string): void {
    this.developerFilter.set(value);
    this.reload();
  }

  onProject(value: number | null): void {
    this.projectFilter.set(value);
    this.reload();
  }

  reset(): void {
    this.period.set('');
    this.developerFilter.set('');
    this.projectFilter.set(null);
    this.reload();
  }

  // ── export ──

  exportReport(): void {
    const rows = this.stats();
    if (rows.length === 0) {
      this.toast.warning(this.t('dashboard.devAnalytics.charts.noData'));
      return;
    }
    const columns: ExportColumn<DeveloperStatRow>[] = [
      { header: this.t('dashboard.devAnalytics.table.developer'), value: (r) => r.fullName },
      { header: this.t('dashboard.devAnalytics.table.completedTasks'), value: (r) => r.completedTasks },
      { header: this.t('dashboard.devAnalytics.table.avgTime'), value: (r) => r.avgCompletionTimeHours },
      { header: this.t('dashboard.devAnalytics.table.resolvedBugs'), value: (r) => r.resolvedBugs },
      { header: this.t('dashboard.devAnalytics.table.workload'), value: (r) => `${r.currentWorkloadPercent}%` },
      { header: this.t('dashboard.devAnalytics.table.productivity'), value: (r) => `${r.productivityPercent}%` },
    ];
    void this.exporter
      .toExcel({
        fileName: this.t('dashboard.devAnalytics.title'),
        sheetName: this.t('dashboard.devAnalytics.table.title'),
        columns,
        rows,
      })
      .catch(() => this.toast.error(this.t('common.loadFailed')));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
