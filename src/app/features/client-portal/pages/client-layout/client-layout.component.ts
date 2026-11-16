import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { NotificationsBellComponent } from '../../../../shared/components/notifications-bell/notifications-bell.component';
import { NotificationToastsComponent } from '../../../../shared/components/notification-toasts/notification-toasts.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * The client's whole app: a slim top bar (logo, "مشاريعي", notifications,
 * account + sign out) over a centred content column. No staff sidebar, no
 * staff routes.
 */
@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    NotificationsBellComponent,
    NotificationToastsComponent,
    UserAvatarComponent,
    ThemeToggleComponent,
    LanguageToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-layout.component.html',
  styleUrl: './client-layout.component.scss',
})
export class ClientLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly company = inject(CompanySettingsService);

  protected readonly user = this.auth.currentUser;
  protected readonly brandLogo = this.company.logoUrl;
  protected readonly brandName = this.company.tradeName;
  protected readonly fallbackLogo = '/assets/img/logo.png';
  protected readonly year = new Date().getFullYear();

  protected onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(this.fallbackLogo)) img.src = this.fallbackLogo;
  }

  protected logout(): void {
    this.auth.logout();
  }
}
