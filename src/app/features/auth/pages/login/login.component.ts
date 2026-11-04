import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { UserRole } from '../../../../core/models/auth.model';
import { AuthService } from '../../../../core/services/auth.service';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { PointerParallaxDirective } from '../../../../shared/directives/pointer-parallax.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { prefersReducedMotion } from '../../../../shared/utils/motion.util';
import { AuthShowcaseComponent } from '../../components/auth-showcase/auth-showcase.component';

/** How long the success check plays before we navigate away. */
const SUCCESS_HOLD_MS = 900;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ThemeToggleComponent,
    LanguageToggleComponent,
    PointerParallaxDirective,
    AuthShowcaseComponent,
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
  /** Login succeeded — the card plays its success state before navigating. */
  readonly succeeded = signal(false);
  /** Drives the one-shot shake on a failed attempt. */
  readonly shaking = signal(false);
  readonly capsLockOn = signal(false);

  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly company = inject(CompanySettingsService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** The animated showcase is desktop-only — don't even render it below lg. */
  readonly compact = inject(BreakpointService).isTabletDown;

  /**
   * White-label branding for the login screen. Display-only: the settings GET
   * is behind auth, so we don't trigger a load here — we read whatever is
   * already cached and fall back to the bundled brand otherwise.
   */
  readonly brandLogo = this.company.logoUrl;
  readonly brandName = this.company.tradeName;
  readonly fallbackLogo = '/assets/img/logo.avif';

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith(this.fallbackLogo)) img.src = this.fallbackLogo;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onPasswordKey(event: KeyboardEvent): void {
    // getModifierState is missing on synthetic/autofill events.
    if (typeof event.getModifierState === 'function') {
      this.capsLockOn.set(event.getModifierState('CapsLock'));
    }
  }

  onCardAnimationEnd(event: AnimationEvent): void {
    if (event.target === event.currentTarget) this.shaking.set(false);
  }

  login(): void {
    if (this.submitting() || this.succeeded() || !this.email.trim() || !this.password) return;

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
          this.succeeded.set(true);
          this.toast.success(this.t('auth.login.success'));

          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const go = () => this.router.navigateByUrl(returnUrl || homeForRole(user.role));
          if (prefersReducedMotion()) {
            go();
            return;
          }
          const timer = setTimeout(go, SUCCESS_HOLD_MS);
          this.destroyRef.onDestroy(() => clearTimeout(timer));
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message ?? this.t('auth.login.failed'));
          this.shaking.set(true);
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
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
