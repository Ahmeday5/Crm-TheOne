import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../../core/models/api-response.model';
import { UserRole } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ThemeToggleComponent,
    LanguageToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  rememberMe = false;

  /** Inline button-spinner / disable state. */
  readonly submitting = signal(false);
  /** Inline error message displayed beneath the form. */
  readonly errorMessage = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    if (this.submitting() || !this.email.trim() || !this.password) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .login({
        email: this.email,
        password: this.password,
        rememberMe: this.rememberMe,
      })
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.toast.success('تم تسجيل الدخول بنجاح');
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(returnUrl || homeForRole(user.role));
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message ?? 'تعذّر تسجيل الدخول، حاول مرة أخرى');
        },
      });
  }
}

/** Where each role lands right after a successful login. */
function homeForRole(role: UserRole): string {
  switch (role) {
    case 'Admin':     return '/';
    case 'Marketing': return '/marketing-dashboard';
    case 'Sales':     return '/sales-dashboard';
    case 'Support':   return '/appsupport-dashboard';
    case 'Developer': return '/developer-dashboard';
  }
}
