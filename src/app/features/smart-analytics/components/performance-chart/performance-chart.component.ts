import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStates,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { RepPerformanceView } from '../../utils/rep-performance.util';

interface PerformanceChartConfig {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  colors: string[];
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  fill: ApexFill;
  states: ApexStates;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis[];
  legend: ApexLegend;
  grid: ApexGrid;
  tooltip: ApexTooltip;
}

/**
 * Team comparison: calls and answered calls as columns, buyers as a line on
 * its own axis (they're an order of magnitude smaller).
 *
 * Colours are read from the live design tokens and recomputed when the
 * theme mode / brand colour / language changes, so the chart matches the
 * rest of the page in light and dark.
 */
@Component({
  selector: 'app-performance-chart',
  standalone: true,
  imports: [NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (config(); as c) {
      <apx-chart
        [series]="c.series"
        [chart]="c.chart"
        [colors]="c.colors"
        [plotOptions]="c.plotOptions"
        [dataLabels]="c.dataLabels"
        [stroke]="c.stroke"
        [fill]="c.fill"
        [states]="c.states"
        [xaxis]="c.xaxis"
        [yaxis]="c.yaxis"
        [legend]="c.legend"
        [grid]="c.grid"
        [tooltip]="c.tooltip">
      </apx-chart>
    }
  `,
  styles: [':host { display: block; min-height: 320px; }'],
})
export class PerformanceChartComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  readonly reps = input.required<RepPerformanceView[]>();

  readonly config = computed<PerformanceChartConfig | null>(() => {
    const reps = this.reps();
    if (!reps.length) return null;

    // Tracked so the chart re-renders with the right palette / labels.
    const mode = this.theme.mode();
    this.theme.color();
    const lang = this.language.lang();

    const t = (key: string) => resolveKey(TRANSLATIONS[lang], `smartAnalytics.performance.chart.${key}`);
    const css = (name: string, fallback: string) =>
      getComputedStyle(this.doc.documentElement).getPropertyValue(name).trim() || fallback;

    const brand = css('--brand-500', '#0066cc');
    const info = css('--info', '#0891b2');
    const success = css('--success', '#16a34a');
    const text = css('--text-3', '#64748b');
    const border = css('--border', '#e5e7eb');
    const callsName = t('calls');
    const answeredName = t('answered');
    const buyersName = t('buyers');
    const axisLabels = { style: { colors: text, fontSize: '12px' } };

    return {
      series: [
        { name: callsName, type: 'column', data: reps.map((r) => r.calls) },
        { name: answeredName, type: 'column', data: reps.map((r) => r.answeredCalls) },
        { name: buyersName, type: 'line', data: reps.map((r) => r.buyers) },
      ],
      chart: {
        type: 'line',
        height: 340,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        background: 'transparent',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 700,
          animateGradually: { enabled: true, delay: 90 },
          dynamicAnimation: { enabled: true, speed: 450 },
        },
      },
      colors: [brand, info, success],
      plotOptions: { bar: { columnWidth: '58%', borderRadius: 5, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      fill: { type: 'solid', opacity: [1, 0.55, 1] },
      states: { hover: { filter: { type: 'darken', value: 0.9 } } },
      xaxis: {
        categories: reps.map((r) => firstName(r.repName)),
        labels: axisLabels,
        axisBorder: { color: border },
        axisTicks: { color: border },
      },
      yaxis: [
        { seriesName: callsName, title: { text: callsName, style: { color: text } }, labels: axisLabels },
        { seriesName: callsName, show: false },
        {
          seriesName: buyersName,
          opposite: true,
          title: { text: buyersName, style: { color: success } },
          labels: { style: { colors: success, fontSize: '12px' } },
        },
      ],
      legend: {
        position: 'top',
        horizontalAlign: 'center',
        labels: { colors: text },
        markers: { offsetX: lang === 'ar' ? 4 : -4 },
        itemMargin: { horizontal: 10 },
      },
      grid: { borderColor: border, strokeDashArray: 4 },
      tooltip: {
        shared: true,
        intersect: false,
        theme: mode,
        x: { formatter: (_: number, opts?: { dataPointIndex: number }) => reps[opts?.dataPointIndex ?? 0]?.repName ?? '' },
      },
    };
  });
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
