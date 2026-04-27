import { Component, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-project-manage',
  standalone: true,
  imports: [],
  templateUrl: './project-manage.component.html',
  styleUrl: './project-manage.component.scss'
})
export class ProjectManageComponent implements AfterViewInit {

  ngAfterViewInit(): void {
    // ────────────────────────────────────────────────
    // شارت 1: نظرة عامة على تقدم المشروعات (Bar Chart)
    // ────────────────────────────────────────────────
    new Chart('projectsProgressChart', {
      type: 'bar',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'التقدم الفعلي',
            data: [20, 30, 42, 50],
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            borderWidth: 1
          },
          {
            label: 'الهدف',
            data: [13, 16.5, 20, 15],
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 60,
            ticks: { stepSize: 10 }
          }
        },
        plugins: {
          legend: { position: 'top' }
        }
      }
    });


    // ────────────────────────────────────────────────
    // شارت 2: إنتاجية المطور (Line Chart)
    // ────────────────────────────────────────────────
    new Chart('developerProductivityChart', {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{
          label: 'ساعات العمل الفعلية',
          data: [6, 7, 5.5, 6.5, 8, 12],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 15,
            ticks: { stepSize: 3 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}