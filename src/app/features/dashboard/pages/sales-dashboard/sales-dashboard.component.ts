import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.scss',
})
export class SalesDashboardComponent {
  // 1. Line Chart - نظرة عامة على الإيرادات
  revenueChartOptions = {
    series: [
      {
        name: 'مسار المبيعات',
        data: [5, 50, 70, 90, 120, 150, 260],
      },
    ],
    chart: {
      type: 'bar' as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: [
        'مغلقة',
        'عملاء جدد',
        'عملاء محتملين',
        'مؤهلون',
        'عرض سعر',
        'تفاوض',
        'تم التواصل',
      ],
    },
    stroke: {
      curve: 'smooth' as const,
    },
    tooltip: {
      x: { format: 'dd/MM/yy HH:mm' },
    },
  };

  // 2. Stacked Bar Chart - الأداء الأسبوعي (مكدس مع 3 سلاسل)
  conversionChartOptions: any = {
    series: [
      {
        name: 'مكالمات',
        data: [15, 20, 25, 30], // الأسبوع 1 → 4
      },
      {
        name: 'اجتماعات',
        data: [10, 15, 20, 25],
      },
      {
        name: 'صفقات',
        data: [5, 10, 15, 20],
      },
    ],
    chart: {
      type: 'bar' as const,
      height: 350,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '45%', // عرض أصغر شوية عشان يبقى فيه مسافة بينهم
        endingShape: 'rounded' as const,
        dataLabels: {
          position: 'top' as const,
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val}`, // أو `${val}%` لو عايز نسبة
      offsetY: -20,
      style: {
        fontSize: '13px',
        colors: ['#000000'], // أسود للوضوح فوق الألوان
        fontWeight: 600,
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 2,
        opacity: 0.35,
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val} عنصر`,
      },
    },
    xaxis: {
      categories: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'],
    },
    yaxis: {
      title: {
        text: 'العدد',
      },
    },
    colors: [
      '#10B981', // أخضر للمكالمات
      '#3B82F6', // أزرق للاجتماعات
      '#F59E0B', // برتقالي للصفقات
    ] as const,
    legend: {
      position: 'bottom' as const,
      horizontalAlign: 'center',
    },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
    },
  };
}
