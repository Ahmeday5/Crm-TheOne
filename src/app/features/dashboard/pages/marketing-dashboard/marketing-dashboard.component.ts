import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { LanguageService } from '../../../../core/services/language.service';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-marketing-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslatePipe, PageHeaderComponent],
  templateUrl: './marketing-dashboard.component.html',
  styleUrl: './marketing-dashboard.component.scss',
})
export class MarketingDashboardComponent {
  private lang = inject(LanguageService);

  weekDays = computed(() => {
    const ar = ['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];
    const en = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return this.lang.lang() === 'ar' ? ar : en;
  });

  platformLabels = computed(() => {
    const d = TRANSLATIONS[this.lang.lang()];
    return [
      resolveKey(d, 'dashboard.sources.facebook'),
      resolveKey(d, 'dashboard.sources.instagram'),
      resolveKey(d, 'dashboard.sources.google'),
      resolveKey(d, 'dashboard.sources.website'),
      resolveKey(d, 'dashboard.sources.referrals'),
      resolveKey(d, 'common.email'),
    ];
  });

  revenueChartOptions = {
    series: [{ name: 'leads', data: [0, 50, 70, 90, 120, 150, 200] }],
    chart: { type: 'line' as const, height: 320, toolbar: { show: false } },
    xaxis: { categories: this.weekDays() },
    stroke: { curve: 'smooth' as const, width: 3 },
    colors: ['#0066cc'],
    tooltip: { x: { format: 'dd/MM/yy HH:mm' } },
  };

  conversionChartOptions: any = {
    series: [{ name: 'leads', data: [2000, 5000, 7000, 9000, 13000, 15000] }],
    chart: { type: 'bar' as const, height: 320, toolbar: { show: false } },
    xaxis: { categories: this.platformLabels() },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%',
        borderRadius: 6,
        dataLabels: { position: 'top' as const },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        const total = 2000 + 5000 + 7000 + 9000 + 13000 + 15000;
        return `${((val / total) * 100).toFixed(1)}%`;
      },
      offsetY: -22,
      style: { fontSize: '12px', colors: ['#10B981'], fontWeight: 600 },
    },
    tooltip: { y: { formatter: (val: number) => `${val.toLocaleString()}` } },
    colors: ['#10B981'],
  };
}
