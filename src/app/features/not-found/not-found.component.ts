import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

/**
 * Polished 404 page. Shown when:
 *   - an authenticated user navigates to an unknown URL
 *   - the role guard would otherwise have nowhere safe to redirect to
 *
 * Renders inside the main layout so the sidebar / topbar stay available.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** "Home" depends on the role — Admin sees the global homepage; others get their own dashboard. */
  readonly homeUrl = computed(() => homeForRole(this.auth.currentRole()));

  goBack(): void {
    // If history is empty (deep-linked into 404) fall back to the role home.
    if (history.length > 1) {
      this.location.back();
    } else {
      this.router.navigateByUrl(this.homeUrl());
    }
  }
}

function homeForRole(role: UserRole | null): string {
  switch (role) {
    case 'Admin':     return '/';
    case 'Marketing': return '/marketing-dashboard';
    case 'Sales':     return '/sales-dashboard';
    case 'Support':   return '/appsupport-dashboard';
    case 'Developer': return '/developer-dashboard';
    default:          return '/auth/login';
  }
}
