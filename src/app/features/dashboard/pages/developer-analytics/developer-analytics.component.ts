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
  BugAnalytics,
  DeveloperAnalyticsCharts,
  DeveloperAnalyticsSummary,
  DeveloperStatRow,
} from '../../../../shared/models';
import { DeveloperAnalyticsService } from '../../services/developer-analytics.service';

type PeriodFilter = 'all' | 'month' | 'quarter';

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

  // ── raw server data ──
  readonly summary = signal<DeveloperAnalyticsSummary | null>(null);
  private readonly allStats = signal<DeveloperStatRow[]>([]);
  readonly charts = signal<DeveloperAnalyticsCharts | null>(null);
  readonly bugs = signal<BugAnalytics | null>(null);
  readonly loading = signal(false);

  // ── filters (client-side; the endpoints take no params) ──
  readonly period = signal<PeriodFilter>('all');
  readonly developerFilter = signal<string>('');
  readonly projectFilter = signal<number | null>(null);

  /** Developer options for the filter — derived from the stats rows. */
  readonly developerOptions = computed(() =>
    this.allStats().map((s) => ({ id: s.developerId, name: s.fullName })),
  );

  /** Project options for the filter — derived from the charts feed. */
  readonly projectOptions = computed(() =>
    (this.charts()?.projectsProgress ?? []).map((p) => ({
      id: p.projectId,
      name: p.projectName,
    })),
  );

  /** Developer table after the developer filter is applied. */
  readonly stats = computed(() => {
    const dev = this.developerFilter();
    const rows = this.allStats();
    return dev ? rows.filter((r) => r.developerId === dev) : rows;
  });

  // ── KPI helpers ──
  readonly openBugs = computed(() => this.summary()?.openBugs ?? 0);

  // ── Chart 1: task completion over time (line, completed vs pending) ──
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

  // ── Chart 2: projects progress (bar; respects the project filter) ──
  readonly progressChart = computed<Record<string, unknown>>(() => {
    const proj = this.projectFilter();
    const pts = (this.charts()?.projectsProgress ?? []).filter(
      (p) => proj === null || p.projectId === proj,
    );
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

  // ── Chart 3: monthly open vs resolved bugs (bar) ──
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

  // ── Chart 4: bug distribution by project (donut; respects project filter) ──
  readonly bugDistributionChart = computed<Record<string, unknown>>(() => {
    const proj = this.projectFilter();
    const pts = (this.bugs()?.distributionByProject ?? []).filter(
      (p) => proj === null || p.projectId === proj,
    );
    return {
      series: pts.map(
        (p) =>
          p.count ?? p.bugCount ?? (p.openBugs ?? 0) + (p.resolvedBugs ?? 0),
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

  /** (Re)fetch all four analytics feeds — also wired to the table's refresh. */
  reload(): void {
    this.loading.set(true);

    this.analytics.summary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
    this.analytics.developerStats().subscribe({
      next: (rows) => this.allStats.set(rows ?? []),
      error: () => this.allStats.set([]),
    });
    this.analytics.charts().subscribe({
      next: (c) => this.charts.set(c),
      error: () => this.charts.set(null),
    });
    this.analytics.bugAnalytics().subscribe({
      next: (b) => {
        this.bugs.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.bugs.set(null);
        this.loading.set(false);
      },
    });
  }

  // ── filter handlers ──

  onPeriod(value: PeriodFilter): void {
    this.period.set(value);
  }
  onDeveloper(value: string): void {
    this.developerFilter.set(value);
  }
  onProject(value: number | null): void {
    this.projectFilter.set(value);
  }
  reset(): void {
    this.period.set('all');
    this.developerFilter.set('');
    this.projectFilter.set(null);
  }

  // ── export (developer stats table) ──

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
