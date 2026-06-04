import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NAV_SECTIONS } from '../../../../core/constants/nav-sections.const';
import { roleLabel } from '../../../../core/constants/roles.const';
import { UserRole } from '../../../../core/models/auth.model';
import { LanguageService } from '../../../../core/services/language.service';
import { UsersService } from '../../../../core/services/users.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface RoleCard {
  name: string;
  label: string;
  icon: string;
  tone: string;
  /** i18n keys of the nav modules this role can reach. */
  moduleKeys: string[];
}

const ROLE_META: Record<string, { icon: string; tone: string }> = {
  Admin: { icon: 'fa-solid fa-shield-halved', tone: 'danger' },
  Developer: { icon: 'fa-solid fa-code', tone: 'info' },
  Sales: { icon: 'fa-solid fa-chart-line', tone: 'success' },
  Marketing: { icon: 'fa-solid fa-bullhorn', tone: 'warning' },
  Support: { icon: 'fa-solid fa-headset', tone: 'purple' },
};

/**
 * Roles & permissions overview. Roles come from the API; for each one we show
 * the modules it can reach, derived from the sidebar navigation map (an item
 * with no `roles` restriction is visible to every role).
 */
@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule, TranslatePipe, PageHeaderComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-permissions.component.html',
  styleUrl: './roles-permissions.component.scss',
})
export class RolesPermissionsComponent {
  private readonly users = inject(UsersService);
  private readonly lang = inject(LanguageService);

  readonly roles = signal<string[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly cards = computed<RoleCard[]>(() =>
    this.roles().map((name) => {
      const meta = ROLE_META[name] ?? { icon: 'fa-solid fa-user-shield', tone: 'primary' };
      return {
        name,
        label: roleLabel(name as UserRole, this.lang.lang()),
        icon: meta.icon,
        tone: meta.tone,
        moduleKeys: this.modulesFor(name),
      };
    }),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.roles().subscribe({
      next: (roles) => {
        this.roles.set(roles ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('load');
      },
    });
  }

  /** Nav modules reachable by a role (un-restricted items count for everyone). */
  private modulesFor(role: string): string[] {
    const keys: string[] = [];
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (!item.roles || item.roles.includes(role as UserRole)) {
          keys.push(item.labelKey);
        }
      }
    }
    return [...new Set(keys)];
  }
}
