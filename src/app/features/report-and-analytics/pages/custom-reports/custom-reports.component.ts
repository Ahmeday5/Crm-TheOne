import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface SavedReport {
  id: string;
  nameKey: string;
  source: string;
  format: string;
  lastRun: string;
}

interface ReportTemplate {
  id: string;
  titleKey: string;
  descKey: string;
  icon: string;
  iconTone: 'primary' | 'success' | 'warning' | 'purple' | 'orange';
}

@Component({
  selector: 'app-custom-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-reports.component.html',
  styleUrl: './custom-reports.component.scss',
})
export class CustomReportsComponent {
  /** Builder state — wired with [(ngModel)]. */
  source = 'leads';
  metric = 'count';
  dimension = 'month';
  period = 'last6Months';
  format: 'table' | 'line' | 'bar' | 'pie' = 'bar';

  readonly sourceOptions = ['leads', 'deals', 'tickets', 'projects', 'employees'];
  readonly periodOptions = ['last30Days', 'last3Months', 'last6Months', 'lastYear'];
  readonly formatOptions: Array<'table' | 'line' | 'bar' | 'pie'> = [
    'table', 'line', 'bar', 'pie',
  ];

  /** Sample saved reports. */
  readonly saved: SavedReport[] = [
    { id: 'r1', nameKey: 'reportAnalysis.custom.templates.monthlyOverview', source: 'deals', format: 'bar', lastRun: '2026-04-22' },
    { id: 'r2', nameKey: 'reportAnalysis.custom.templates.salesPerformance', source: 'leads', format: 'line', lastRun: '2026-04-15' },
    { id: 'r3', nameKey: 'reportAnalysis.custom.templates.teamWorkload', source: 'projects', format: 'pie', lastRun: '2026-04-08' },
  ];

  readonly templates: ReportTemplate[] = [
    {
      id: 'monthly',
      titleKey: 'reportAnalysis.custom.templates.monthlyOverview',
      descKey: 'reportAnalysis.custom.templates.monthlyOverviewDesc',
      icon: 'fa-solid fa-chart-line',
      iconTone: 'primary',
    },
    {
      id: 'sales',
      titleKey: 'reportAnalysis.custom.templates.salesPerformance',
      descKey: 'reportAnalysis.custom.templates.salesPerformanceDesc',
      icon: 'fa-solid fa-arrow-trend-up',
      iconTone: 'success',
    },
    {
      id: 'funnel',
      titleKey: 'reportAnalysis.custom.templates.leadFunnel',
      descKey: 'reportAnalysis.custom.templates.leadFunnelDesc',
      icon: 'fa-solid fa-filter',
      iconTone: 'warning',
    },
    {
      id: 'workload',
      titleKey: 'reportAnalysis.custom.templates.teamWorkload',
      descKey: 'reportAnalysis.custom.templates.teamWorkloadDesc',
      icon: 'fa-solid fa-people-group',
      iconTone: 'purple',
    },
  ];

  resetBuilder(): void {
    this.source = 'leads';
    this.metric = 'count';
    this.dimension = 'month';
    this.period = 'last6Months';
    this.format = 'bar';
  }
}
