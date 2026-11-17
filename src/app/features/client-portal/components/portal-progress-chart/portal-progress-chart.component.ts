import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import { ProgressPoint, ProgressRange } from '../../models/client-portal.models';

const RANGES: ReadonlyArray<ProgressRange> = ['30d', '90d', 'all'];

/**
 * "How far along, over time" — `progress-history` as a smooth line with a
 * flat (solid, low-opacity) fill. Range switch: 30 / 90 days / all. A live
 * update appends today's point without a refetch.
 */
@Component({
  selector: 'app-portal-progress-chart',
  standalone: true,
  imports: [NgApexchartsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pc-head">
      <div>
        <h2 class="pc-title"><i class="fa-solid fa-chart-line" aria-hidden="true"></i>{{ 'portal.chart.title' | translate }}</h2>
        <p class="pc-sub">{{ 'portal.chart.subtitle' | translate }}</p>
      </div>
      <div class="pc-range" role="group" [attr.aria-label]="'portal.chart.range' | translate">
        @for (r of ranges; track r) {
          <button type="button" [class.is-active]="range() === r" [attr.aria-pressed]="range() === r" (click)="setRange(r)">
            {{ 'portal.chart.ranges.' + r | translate }}
          </button>
        }
      </div>
    </div>
    @if (points(); as pts) {
      @if (pts.length > 1) {
        <div class="pc-chart">
          <apx-chart
            [series]="$any(options().series)"
            [chart]="$any(options().chart)"
            [xaxis]="$any(options().xaxis)"
            [yaxis]="$any(options().yaxis)"
            [stroke]="$any(options().stroke)"
            [fill]="$any(options().fill)"
            [grid]="$any(options().grid)"
            [colors]="$any(options().colors)"
            [markers]="$any(options().markers)"
            [tooltip]="$any(options().tooltip)"
            [dataLabels]="$any(options().dataLabels)"
          />
        </div>
      } @else {
        <div class="pc-empty"><i class="fa-solid fa-seedling" aria-hidden="true"></i>{{ 'portal.chart.empty' | translate }}</div>
      }
    } @else if (failed()) {
      <div class="pc-empty">{{ 'clientPortal.errors.load' | translate }}</div>
    } @else {
      <div class="pc-sk" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host { display: block; }
    .pc-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; }
    .pc-title { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: var(--fs-lg); font-weight: var(--fw-700); }
    .pc-title i { color: var(--brand-500); }
    .pc-sub { margin: 0.15rem 0 0; color: var(--text-3); font-size: var(--fs-sm); }
    .pc-range { display: inline-flex; padding: 3px; border-radius: var(--radius-pill); background: var(--surface-2); }
    .pc-range button {
      min-height: 32px; padding: 0 0.8rem; border: 0; border-radius: var(--radius-pill);
      background: transparent; color: var(--text-2); font-size: var(--fs-xs); font-weight: var(--fw-700);
      transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
    }
    .pc-range button.is-active { background: var(--surface-0); color: var(--brand-500); box-shadow: var(--shadow-sm); }
    .pc-chart { margin-inline: -0.5rem; min-height: 240px; }
    .pc-empty { display: flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 200px; color: var(--text-3); font-size: var(--fs-sm); }
    .pc-sk { height: 240px; border-radius: var(--radius-lg); background: var(--surface-2); animation: pc-pulse 1.2s ease-in-out infinite; }
    @keyframes pc-pulse { 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) { .pc-sk { animation: none; } }
  `,
})
export class PortalProgressChartComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  readonly projectId = input.required<number>();
  /** Current progress — a live change appends / updates today's point. */
  readonly current = input<number | null>(null);

  protected readonly ranges = RANGES;
  protected readonly range = signal<ProgressRange>('all');
  protected readonly points = signal<ProgressPoint[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly options = computed<ApexOptions>(() => {
    const pts = this.points() ?? [];
    const dark = this.theme.mode() === 'dark';
    const text = dark ? '#94a3b8' : '#64748b';
    const grid = dark ? '#232c42' : '#e5e7eb';
    const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim() || '#0066cc';
    const locale = this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB';
    const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    return {
      series: [{ name: '%', data: pts.map((p) => ({ x: Date.parse(p.date), y: p.percent })) }],
      chart: {
        type: 'area',
        height: 250,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        background: 'transparent',
        animations: { enabled: true, speed: 900, animateGradually: { enabled: true, delay: 60 } },
      },
      colors: [brand],
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'solid', opacity: 0.12 },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 6 } },
      grid: { borderColor: grid, strokeDashArray: 4, padding: { left: 8, right: 8 } },
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: text }, formatter: (v: string) => dayFmt.format(new Date(Number(v))) },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 4,
        opposite: this.language.lang() === 'ar',
        labels: { style: { colors: text }, formatter: (v: number) => `${Math.round(v)}%` },
      },
      tooltip: {
        theme: dark ? 'dark' : 'light',
        x: { formatter: (v: number) => dayFmt.format(new Date(v)) },
        y: { formatter: (v: number) => `${v.toFixed(1).replace(/\.0$/, '')}%` },
      },
    };
  });

  constructor() {
    effect(() => {
      const id = this.projectId();
      const range = this.range();
      untracked(() => this.load(id, range));
    });
    effect(() => {
      const value = this.current();
      if (value == null) return;
      untracked(() => this.patchToday(value));
    }, { allowSignalWrites: true });
  }

  protected setRange(r: ProgressRange): void {
    this.range.set(r);
  }

  private load(projectId: number, range: ProgressRange): void {
    this.failed.set(false);
    this.api.progressHistory(projectId, range).subscribe({
      next: (pts) => this.points.set(pts),
      error: () => this.failed.set(true),
    });
  }

  private patchToday(value: number): void {
    const pts = this.points();
    if (!pts?.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = pts[pts.length - 1];
    if (last.percent === value) return;
    this.points.set(last.date === today ? [...pts.slice(0, -1), { date: today, percent: value }] : [...pts, { date: today, percent: value }]);
  }
}
