import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientProject } from '../../models/client-portal.models';
import { ClientPortalService } from '../../services/client-portal.service';

/** The client's landing page: one card per project — where it stands, at a glance. */
@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.scss',
})
export class PortalHomeComponent {
  private readonly api = inject(ClientPortalService);
  private readonly auth = inject(AuthService);

  protected readonly projects = signal<ClientProject[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly firstName = computed(() => (this.auth.currentUser()?.fullName ?? '').trim().split(/\s+/)[0] || '');
  protected readonly statusClass = projectStatusBadgeClass;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.api.myProjects().subscribe({
      next: (list) => this.projects.set(list),
      error: () => this.failed.set(true),
    });
  }
}
