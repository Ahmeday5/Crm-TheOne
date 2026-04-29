import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-report-and-analytics',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-and-analytics.component.html',
  styleUrl: './report-and-analytics.component.scss',
})
export class ReportAndAnalyticsComponent {
  readonly tabs: TabbedNavItem[] = [
    {
      routerLink: 'panel',
      labelKey: 'reportAnalysis.tabs.panel',
      icon: 'fa-solid fa-chart-column',
      color: 'primary',
    },
    {
      routerLink: 'emp-report',
      labelKey: 'reportAnalysis.tabs.empReport',
      icon: 'fa-solid fa-clipboard-list',
      color: 'indigo',
    },
    {
      routerLink: 'marketing-report',
      labelKey: 'reportAnalysis.tabs.marketingReport',
      icon: 'fa-solid fa-users',
      color: 'green',
    },
    {
      routerLink: 'sales-report',
      labelKey: 'reportAnalysis.tabs.salesReport',
      icon: 'fa-solid fa-arrow-trend-up',
      color: 'yellow',
    },
    {
      routerLink: 'app-report',
      labelKey: 'reportAnalysis.tabs.appReport',
      icon: 'fa-solid fa-headphones',
      color: 'orange',
    },
    {
      routerLink: 'projects-report',
      labelKey: 'reportAnalysis.tabs.projectReport',
      icon: 'fa-solid fa-folder-open',
      color: 'purple',
    },
    {
      routerLink: 'custom-report',
      labelKey: 'reportAnalysis.tabs.customReport',
      icon: 'fa-solid fa-file-lines',
      color: 'gray',
    },
  ];
}
