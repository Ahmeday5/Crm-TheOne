import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProgressRingComponent } from '../../../../shared/components/progress-ring/progress-ring.component';
import { AnimatedNumberDirective } from '../../../../shared/directives/animated-number.directive';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import { ClientProject } from '../../models/client-portal.models';
import { PortalBrandingService } from '../../services/portal-branding.service';
import { PortalLiveService } from '../../services/portal-live.service';
import { PortalSessionService } from '../../services/portal-session.service';
import { healthIcon, healthTone, platformIcon } from '../../utils/client-portal-ui.util';

/**
 * The client's landing page: a warm greeting, a summary strip (counts up),
 * then one card per project — ring, status, schedule health, next milestone,
 * latest app version, open requests. Progress updates live.
 */
@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe, TimeAgoPipe, ProgressRingComponent, AnimatedNumberDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.scss',
})
export class PortalHomeComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);
  protected readonly session = inject(PortalSessionService);
  protected readonly brand = inject(PortalBrandingService);

  protected readonly projects = signal<ClientProject[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly firstName = computed(() => this.session.displayName().trim().split(/\s+/)[0] || '');
  protected readonly greetingKey = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'portal.home.morning' : h < 18 ? 'portal.home.afternoon' : 'portal.home.evening';
  });

  protected readonly stats = computed(() => {
    const list = this.projects() ?? [];
    const active = list.filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled');
    const avg = active.length ? active.reduce((s, p) => s + p.progressPercent, 0) / active.length : 0;
    return {
      projects: list.length,
      avgProgress: Math.round(avg),
      openRequests: list.reduce((s, p) => s + p.openRequestsCount, 0),
      releases: list.filter((p) => p.latestRelease).length,
    };
  });

  protected readonly statusClass = projectStatusBadgeClass;
  protected readonly healthTone = healthTone;
  protected readonly healthIcon = healthIcon;
  protected readonly platformIcon = platformIcon;

  constructor() {
    this.load();
    inject(PortalLiveService)
      .progress$.pipe(takeUntilDestroyed())
      .subscribe((e) =>
        this.projects.update((list) =>
          list?.map((p) =>
            p.projectId === e.projectId ? { ...p, progressPercent: e.progressPercent, status: e.status, lastUpdateAt: e.changedAt } : p,
          ) ?? list,
        ),
      );
  }

  protected load(): void {
    this.failed.set(false);
    this.api.myProjects().subscribe({
      next: (list) => this.projects.set(list),
      error: () => this.failed.set(true),
    });
  }
}
