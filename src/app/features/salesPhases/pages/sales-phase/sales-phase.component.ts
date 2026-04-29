import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-sales-phase',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-phase.component.html',
  styleUrl: './sales-phase.component.scss',
})
export class SalesPhaseComponent {
  readonly tabs: TabbedNavItem[] = [
    {
      routerLink: 'line',
      labelKey: 'sales.tabs.line',
      icon: 'fa-solid fa-table-cells',
      color: 'primary',
    },
    {
      routerLink: 'price-offers',
      labelKey: 'sales.tabs.priceOffers',
      icon: 'fa-regular fa-file-lines',
      color: 'indigo',
    },
    {
      routerLink: 'contracts',
      labelKey: 'sales.tabs.contracts',
      icon: 'fa-regular fa-file',
      color: 'green',
    },
    {
      routerLink: 'follow-ups',
      labelKey: 'sales.tabs.followUps',
      icon: 'fa-solid fa-calendar-day',
      color: 'orange',
    },
  ];
}
