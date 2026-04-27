import { Component, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

interface StatCard {
  title: string;
  value: number | string;
  extra: string;
  colorClass: string;
  icon: string; // bootstrap icon class
}

interface WeeklyTicket {
  day: string;
  solved: number;
}

interface TicketStatus {
  name: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-dashboard-app-support',
  standalone: true,
  templateUrl: './dashboard-app-support.component.html',
  styleUrls: ['./dashboard-app-support.component.scss'],
})
export class DashboardAppSupportComponent implements AfterViewInit {

  constructor( private route: Router) {}

  stats: StatCard[] = [
    {
      title: 'العملاء المعينون',
      value: 8,
      extra: '+2 اليوم',
      colorClass: 'text-primary',
      icon: 'bi-people-fill',
    },
    {
      title: 'الجلسات النشطة',
      value: 3,
      extra: 'جارية الآن',
      colorClass: 'text-success',
      icon: 'bi-headset',
    },
    {
      title: 'التذاكر المفتوحة',
      value: 25,
      extra: '5 ذات أولوية عالية',
      colorClass: 'text-warning',
      icon: 'bi-ticket-perforated',
    },
    {
      title: 'تم حلها اليوم',
      value: 12,
      extra: 'الهدف: 10',
      colorClass: 'text-info',
      icon: 'bi-check-circle-fill',
    },
  ];

  weeklyTickets: WeeklyTicket[] = [
    { day: 'الأحد', solved: 10 },
    { day: 'الإثنين', solved: 15 },
    { day: 'الثلاثاء', solved: 8 },
    { day: 'الأربعاء', solved: 20 },
    { day: 'الخميس', solved: 12 },
    { day: 'الجمعة', solved: 5 },
    { day: 'السبت', solved: 3 },
  ];

  ticketStatus: TicketStatus[] = [
    { name: 'مفتوحة', value: 12, color: '#3b82f6' },
    { name: 'قيد المعالجة', value: 8, color: '#f59e0b' },
    { name: 'بالانتظار', value: 5, color: '#8b5cf6' },
    { name: 'محلولة', value: 25, color: '#10b981' },
  ];

  responseTimes = {
    avgResponse: '12 دقيقة',
    avgResolve: '2.5 ساعة',
    criticalTickets: 2,
  };

  ngAfterViewInit(): void {
    new Chart('weeklyChart', {
      type: 'bar',
      data: {
        labels: this.weeklyTickets.map((w) => w.day),
        datasets: [
          {
            label: 'تم الحل',
            data: this.weeklyTickets.map((w) => w.solved),
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    new Chart('statusPie', {
      type: 'pie',
      data: {
        labels: this.ticketStatus.map((s) => s.name),
        datasets: [
          {
            data: this.ticketStatus.map((s) => s.value),
            backgroundColor: this.ticketStatus.map((s) => s.color),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  }

  goToTechnicalConsultation() {
    this.route.navigate(['/technical-consultation'])
  }

  goToDetailsOfSupportCases() {
    this.route.navigate(['/details-of-support-cases'])
  }
}
