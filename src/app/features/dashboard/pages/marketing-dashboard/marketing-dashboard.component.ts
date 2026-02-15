import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-marketing-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './marketing-dashboard.component.html',
  styleUrl: './marketing-dashboard.component.scss',
})
export class MarketingDashboardComponent {
  // 1. Line Chart - نظرة عامة على الإيرادات
  revenueChartOptions = {
    series: [
      {
        name: 'عدد العملاء اليومي (آخر 7 أيام)',
        data: [0, 50, 70, 90, 120, 150, 200],
      },
    ],
    chart: {
      type: 'line' as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت' ,'الأحد'],
    },
    stroke: {
      curve: 'smooth' as const,
    },
    tooltip: {
      x: { format: 'dd/MM/yy HH:mm' },
    },
  };

  // 2. Bar Chart - العملاء المحتملين حسب المنصة
  conversionChartOptions: any = {
    series: [
      {
        name: 'العملاء المحتملين',
        data: [2000, 5000, 7000, 9000, 13000, 15000],
      },
    ],
    chart: {
      type: 'bar' as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: [
        'فيسبوك',
        'إنستغرام',
        'إعلانات جوجل',
        'الموقع الإلكتروني',
        'الإحالات',
        'البريد الإلكتروني',
      ],
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        endingShape: 'rounded' as const,
        dataLabels: {
          position: 'top' as const,
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        const total = 2000 + 5000 + 7000 + 9000 + 13000 + 15000;
        const percentage = ((val / total) * 100).toFixed(1);
        return `${percentage}%`;
      },
      offsetY: -25,
      style: {
        fontSize: '13px',
        colors: ['#10B981'],
        fontWeight: 600,
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 2,
        opacity: 0.4,
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toLocaleString()} عميل`,
      },
    },
    colors: ['#10B981'] as const,
  };
}
