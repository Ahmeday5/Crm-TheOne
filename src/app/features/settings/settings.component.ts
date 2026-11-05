import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  TabbedNavCardComponent,
  TabbedNavItem,
} from '../../shared/components/tabbed-nav-card/tabbed-nav-card.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SETTINGS_SERVICES_ROLES } from './settings.routes';

interface SettingsTab extends TabbedNavItem {
  /** Who sees the tab — must match the route's `data.roles`. */
  roles: UserRole[];
}

const ADMIN: UserRole[] = ['Admin'];

/**
 * Settings shell. Tabs are filtered by role so Marketing (who only manages
 * services) never sees admin-only tabs it can't open.
 *
 * Not shown yet (placeholder pages exist): activity, audit, notifications, backup.
 */
const TABS: SettingsTab[] = [
  { routerLink: 'users', labelKey: 'settings.tabs.users', icon: 'fa-solid fa-users', color: 'primary', roles: ADMIN },
  { routerLink: 'roles', labelKey: 'settings.tabs.roles', icon: 'fa-solid fa-shield-halved', color: 'green', roles: ADMIN },
  { routerLink: 'services', labelKey: 'settings.tabs.services', icon: 'fa-solid fa-screwdriver-wrench', color: 'orange', roles: SETTINGS_SERVICES_ROLES },
  { routerLink: 'system', labelKey: 'settings.tabs.system', icon: 'fa-solid fa-gear', color: 'purple', roles: ADMIN },
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, PageHeaderComponent, TabbedNavCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);

  readonly tabs = computed<TabbedNavItem[]>(() => {
    const role = this.auth.currentRole();
    return TABS.filter((t) => !!role && t.roles.includes(role));
  });
}
