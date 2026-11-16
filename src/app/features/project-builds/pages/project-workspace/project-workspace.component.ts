import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectDetail, projectStatusBadgeClass } from '../../../../shared/models';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { provideProjectBuildsGateway } from '../../data/project-builds-gateway.provider';
import { BuildsPanelComponent } from '../../components/builds-panel/builds-panel.component';
import { TeamAllocationComponent } from '../../components/team-allocation/team-allocation.component';
import { RequestsListComponent } from '../../../client-portal/components/requests-list/requests-list.component';
import { provideClientPortalGateway } from '../../../client-portal/data/client-portal-gateway.provider';

type Tab = 'team' | 'builds' | 'requests';

/**
 * The one place an admin runs a project from: its header + status, the team
 * with each developer's allocation %, and the build archive (APK + auto-push to
 * GitHub). A developer reaching their own project sees the same page read-mostly
 * (can publish builds, can't re-allocate).
 *
 * Reached at `/projects/:id/workspace`.
 */
@Component({
  selector: 'app-project-workspace',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, TranslatePipe, TeamAllocationComponent, BuildsPanelComponent, RequestsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideProjectBuildsGateway(), provideClientPortalGateway()],
  templateUrl: './project-workspace.component.html',
  styleUrl: './project-workspace.component.scss',
})
export class ProjectWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsApi = inject(ProjectsService);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  protected readonly projectId = signal<number>(Number(this.route.snapshot.paramMap.get('id')) || 0);
  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly tab = signal<Tab>('team');

  protected readonly statusClass = projectStatusBadgeClass;

  constructor() {
    const id = this.projectId();
    const load$ = this.isAdmin() ? this.projectsApi.getById(id) : this.projectsApi.myGetById(id);
    load$
      .pipe(
        catchError(() => {
          this.failed.set(true);
          return of(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        this.loading.set(false);
        if (p) this.project.set(p);
      });
  }
}
