import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface DemoAccount { email: string; pass: string; }
type DemoRole = 'admin' | 'marketing' | 'sales' | 'support' | 'developer';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ThemeToggleComponent, LanguageToggleComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  rememberMe = false;

  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly accounts: Record<DemoRole, DemoAccount> = {
    admin:     { email: 'admin@admin.com',         pass: 'admin123' },
    marketing: { email: 'marketing@marketing.com', pass: 'marketing123' },
    sales:     { email: 'sales@sales.com',         pass: 'sales123' },
    support:   { email: 'support@support.com',     pass: 'support123' },
    developer: { email: 'developer@developer.com', pass: 'dev123' },
  };

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.authService.login(this.email, this.password);
    this.router.navigate(['/leads']);
  }

  quickLogin(role: DemoRole): void {
    const acc = this.accounts[role];
    this.email = acc.email;
    this.password = acc.pass;
  }
}
