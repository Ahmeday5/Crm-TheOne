import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { roleLabel } from '../../../core/constants/roles.const';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent, LanguageToggleComponent, TranslatePipe, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private sidebar = inject(SidebarService);
  private auth = inject(AuthService);
  private language = inject(LanguageService);

  /** Live user object — drives the topbar profile pill. */
  readonly currentUser = this.auth.currentUser;

  /** Localized role label (e.g. "مدير النظام") for the role under the email. */
  readonly currentRoleLabel = computed(() =>
    roleLabel(this.auth.currentRole(), this.language.lang()),
  );

  toggleSidebar(): void {
    this.sidebar.toggle();
  }

  logout(): void {
    this.auth.logout();
  }
}
