import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { roleLabel } from '../../../core/constants/roles.const';
import { AuthService } from '../../../core/services/auth.service';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { PushNotificationsService } from '../../../core/services/push-notifications.service';
import { Lang, LanguageService } from '../../../core/services/language.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import { RouterLink } from "@angular/router";
import { PwaService } from '../../../core/pwa/pwa.service';
import { CommandCenterUiService, CommandTriggerComponent, TourService } from '../../../features/command-center';
import { AttendanceClockChipComponent } from '../../../features/attendance';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, LanguageToggleComponent, NotificationsBellComponent, TranslatePipe, RouterLink, UserAvatarComponent, CommandTriggerComponent, AttendanceClockChipComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private sidebar = inject(SidebarService);
  private auth = inject(AuthService);
  private language = inject(LanguageService);
  private readonly companySettings = inject(CompanySettingsService);
  private readonly push = inject(PushNotificationsService);
  private readonly tour = inject(TourService);
  private readonly commandUi = inject(CommandCenterUiService);
  private readonly pwa = inject(PwaService);

  /** Browser offered to install the PWA → show "Install app" in the menu. */
  readonly canInstall = this.pwa.canInstall;

  /** White-label brand — dynamic logo + name from company settings. */
  readonly brandLogo = this.companySettings.logoUrl;
  readonly brandName = this.companySettings.companyName;
  /** Fallback logo when the tenant hasn't uploaded one. */
  readonly fallbackLogo = '/assets/img/logo.png';

  /** Live user object — drives the topbar profile pill. */
  readonly currentUser = this.auth.currentUser;

  /** Name for the avatar initial + pill label (falls back to the e-mail). */
  readonly displayName = computed(() => this.currentUser()?.fullName || this.currentUser()?.email || '');

  /** Settings are Admin-only (the route guard enforces it; this just hides the link). */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** Localized role label (e.g. "مدير النظام") for the role under the email. */
  readonly currentRoleLabel = computed(() =>
    roleLabel(this.auth.currentRole(), this.language.lang()),
  );

  /** Swap to the bundled logo if the remote brand image fails to load. */
  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.fallbackLogo) img.src = this.fallbackLogo;
  }

  /** Phone-only language switch inside the profile menu (mirrors app-language-toggle). */
  readonly lang = this.language.lang;
  readonly langs: { key: Lang; label: string }[] = [
    { key: 'ar', label: 'العربية' },
    { key: 'en', label: 'English' },
  ];

  setLang(lang: Lang): void {
    this.language.setLang(lang);
  }

  startTour(): void {
    this.tour.start();
  }

  openShortcuts(): void {
    this.commandUi.openHelp();
  }

  installApp(): void {
    void this.pwa.install();
  }

  toggleSidebar(): void {
    this.sidebar.toggle();
  }

  logout(): void {
    // Unregister this device's push token (request fires with the still-valid
    // bearer) before the session is cleared.
    void this.push.disable();
    this.auth.logout();
  }
}
