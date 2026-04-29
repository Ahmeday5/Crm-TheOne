import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-app-support-main',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-support-main.component.html',
  styleUrl: './app-support-main.component.scss',
})
export class AppSupportMainComponent {
  readonly tabs: TabbedNavItem[] = [
    {
      routerLink: 'dashboardSupport',
      labelKey: 'support.tabs.dashboard',
      icon: 'fa-solid fa-table-cells',
      color: 'primary',
    },
    {
      routerLink: 'Designated-clients',
      labelKey: 'support.tabs.designatedClients',
      icon: 'fa-solid fa-users',
      color: 'green',
    },
    {
      routerLink: 'SupportTickets',
      labelKey: 'support.tabs.tickets',
      icon: 'fa-solid fa-ticket',
      color: 'orange',
    },
    {
      routerLink: 'SupportLog',
      labelKey: 'support.tabs.log',
      icon: 'fa-solid fa-book-open',
      color: 'purple',
    },
  ];
}
