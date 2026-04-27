import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LanguageService } from '../../../../core/services/language.service';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslatePipe, PageHeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private lang = inject(LanguageService);

  /** Translated chart axes / labels — recompute on language change. */
  monthCategories = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return ['jan','feb','mar','apr','may','jun'].map((k) =>
      resolveKey(d, `dashboard.months.${k}`),
    );
  });
  sourceLabels = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return ['facebook','instagram','google','website','referrals'].map((k) =>
      resolveKey(d, `dashboard.sources.${k}`),
    );
  });
  revenueAxisTitle = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return `${resolveKey(d, 'dashboard.revenue')} ( ${resolveKey(d, 'dashboard.currency')} )`;
  });

  revenueChartOptions = {
    series: [{ name: 'Revenue', data: [30000, 40000, 35000, 50000, 49000, 60000] }],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    xaxis: { categories: this.monthCategories() },
    yaxis: { title: { text: this.revenueAxisTitle() } },
    stroke: { curve: 'smooth' as const, width: 3 },
    colors: ['#0066cc'],
    tooltip: { x: { format: 'dd/MM/yy HH:mm' } },
  };

  conversionChartOptions = {
    series: [{ name: 'Conversion', data: [22, 32, 27, 42, 47, 41] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    xaxis: { categories: this.monthCategories() },
    yaxis: { title: { text: '%' } },
    colors: ['#0066cc'],
    plotOptions: {
      bar: { horizontal: false, columnWidth: '50%', borderRadius: 6 },
    },
    tooltip: { y: { formatter: (val: number) => val + ' %' } },
  };

  leadsSourcesChartOptions = {
    series: [450, 320, 280, 200, 150],
    chart: { type: 'pie' as const, height: 320 },
    labels: this.sourceLabels(),
    legend: { position: 'bottom' as const },
    responsive: [{
      breakpoint: 480,
      options: { chart: { width: 200 }, legend: { position: 'bottom' as const } },
    }],
  };
}
