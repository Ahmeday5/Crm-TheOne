import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly tabs: TabbedNavItem[] = [
    {
      routerLink: 'users',
      labelKey: 'settings.tabs.users',
      icon: 'fa-solid fa-users',
      color: 'primary',
    },
    {
      routerLink: 'roles',
      labelKey: 'settings.tabs.roles',
      icon: 'fa-solid fa-shield-halved',
      color: 'green',
    },
    {
      routerLink: 'system',
      labelKey: 'settings.tabs.system',
      icon: 'fa-solid fa-gear',
      color: 'purple',
    },
    /*{
      routerLink: 'activity',
      labelKey: 'settings.tabs.activity',
      icon: 'fa-solid fa-bolt',
      color: 'orange',
    },
    {
      routerLink: 'audit',
      labelKey: 'settings.tabs.audit',
      icon: 'fa-solid fa-file-magnifying-glass',
      color: 'indigo',
    },
    {
      routerLink: 'notifications',
      labelKey: 'settings.tabs.notifications',
      icon: 'fa-solid fa-bell',
      color: 'yellow',
    },
    {
      routerLink: 'backup',
      labelKey: 'settings.tabs.backup',
      icon: 'fa-solid fa-database',
      color: 'pink',
    },*/
  ];
}
