import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  // 1. Line Chart - نظرة عامة على الإيرادات
  revenueChartOptions = {
    series: [
      {
        name: 'الإيرادات',
        data: [30000, 40000, 35000, 50000, 49000, 60000],
      },
    ],
    chart: {
      type: 'line' as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    },
    yaxis: {
      title: { text: 'الإيرادات ( جنية )' },
    },
    stroke: {
      curve: 'smooth' as const,
    },
    tooltip: {
      x: { format: 'dd/MM/yy HH:mm' },
    },
  };

  // 2. Bar Chart - معدل تحويل المبيعات
  conversionChartOptions = {
    series: [
      {
        name: 'معدل التحويل',
        data: [22, 32, 27, 42, 47, 41],
      },
    ],
    chart: {
      type: 'bar' as const,
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    },
    yaxis: {
      title: { text: 'المعدل (%)' },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        endingShape: 'rounded' as const,
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => val + ' %',
      },
    },
  };

  // 3. Pie Chart - مصادر العملاء المحتملين
  leadsSourcesChartOptions = {
    series: [450, 320, 280, 200, 150],
    chart: {
      type: 'pie' as const,
      height: 350,
    },
    labels: [
      'فيسبوك',
      'إنستجرام',
      'إعلانات جوجل',
      'الموقع الإلكتروني',
      'الإحالات',
    ],
    legend: {
      position: 'bottom' as const, // ← هنا الحل: أضف as const
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: { width: 200 },
          legend: { position: 'bottom' as const },
        },
      },
    ],
  };
}
