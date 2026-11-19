import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ProjectDetail, ProjectProgressSummaryDto, projectStatusBadgeClass } from '../../../../shared/models';
import { MyProjectProgressComponent } from '../../../project-progress/pages/my-project-progress/my-project-progress.component';
import { ProjectProgressService } from '../../../project-progress/services/project-progress.service';
import { ProjectProgressSyncService } from '../../../project-progress/services/project-progress-sync.service';
import { ProjectReportsPanelComponent } from '../../components/project-reports-panel/project-reports-panel.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ClientRequestsPanelComponent } from '../../../client-portal/components/client-requests-panel/client-requests-panel.component';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../../../client-requests/data/staff-client-requests.gateway';
import { ProjectSurfacesCardComponent } from '../../../client-requests/components/project-surfaces-card/project-surfaces-card.component';
import { ClientLinkCardComponent } from '../../components/client-link-card/client-link-card.component';
import { DeliverablesPanelComponent } from '../../components/deliverables-panel/deliverables-panel.component';
import { MilestonesPanelComponent } from '../../components/milestones-panel/milestones-panel.component';
import { ProjectTasksPanelComponent } from '../../components/project-tasks-panel/project-tasks-panel.component';
import { ProjectTimelineComponent } from '../../components/project-timeline/project-timeline.component';
import { TeamAllocationComponent } from '../../components/team-allocation/team-allocation.component';

export type WorkspaceTab =
  | 'overview'
  | 'team'
  | 'tasks'
  | 'reports'
  | 'myReport'
  | 'milestones'
  | 'requests'
  | 'deliverables'
  | 'client';

interface TabDef {
  id: WorkspaceTab;
  icon: string;
  labelKey: string;
  /** Who sees it (both when omitted). */
  only?: 'admin' | 'developer';
}

const TABS: ReadonlyArray<TabDef> = [
  { id: 'overview', icon: 'fa-solid fa-gauge', labelKey: 'projectWorkspace.tabs.overview' },
  { id: 'myReport', icon: 'fa-solid fa-pen-to-square', labelKey: 'projectWorkspace.tabs.myReport', only: 'developer' },
  { id: 'team', icon: 'fa-solid fa-people-group', labelKey: 'projectWorkspace.tabs.team' },
  { id: 'tasks', icon: 'fa-solid fa-list-check', labelKey: 'projectWorkspace.tabs.tasks' },
  { id: 'reports', icon: 'fa-solid fa-file-lines', labelKey: 'projectWorkspace.tabs.reports', only: 'admin' },
  { id: 'milestones', icon: 'fa-solid fa-flag-checkered', labelKey: 'projectWorkspace.tabs.milestones' },
  { id: 'requests', icon: 'fa-solid fa-message', labelKey: 'projectWorkspace.tabs.requests' },
  { id: 'deliverables', icon: 'fa-solid fa-box-open', labelKey: 'projectWorkspace.tabs.deliverables' },
  { id: 'client', icon: 'fa-solid fa-link', labelKey: 'projectWorkspace.tabs.client', only: 'admin' },
];

/**
 * `/projects/:id` — everything about one project in one place (tabs).
 * Admin: every tab. Developer (assigned): overview with their share, the team
 * read-only, their tasks, milestones (edit, no delete), client requests and
 * deliverables (credentials + app releases). The active tab is
 * in the URL (`?tab=`) so links and notifications land on it.
 */
@Component({
  selector: 'app-project-workspace',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    CairoDatePipe,
    TeamAllocationComponent,
    ProjectTasksPanelComponent,
    MilestonesPanelComponent,
    ClientRequestsPanelComponent,
    DeliverablesPanelComponent,
    ClientLinkCardComponent,
    ProjectSurfacesCardComponent,
    ProjectTimelineComponent,
    ProjectReportsPanelComponent,
    MyProjectProgressComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-workspace.component.html',
  styleUrl: './project-workspace.component.scss',
})
export class ProjectWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsApi = inject(ProjectsService);
  private readonly requestsApi = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly progressApi = inject(ProjectProgressService);
  private readonly auth = inject(AuthService);
  private readonly progressSync = inject(ProjectProgressSyncService);

  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  protected readonly isDeveloper = computed(() => this.auth.currentRole() === 'Developer');
  /** Which endpoint family the shared panels call. */
  protected readonly scope = computed<'admin' | 'developer'>(() => (this.isAdmin() ? 'admin' : 'developer'));

  protected readonly projectId = Number(this.route.snapshot.paramMap.get('id')) || 0;
  protected readonly project = signal<ProjectDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly openRequests = signal(0);

  protected readonly tabs = computed(() =>
    TABS.filter(
      (t) => !t.only || (t.only === 'admin' && this.isAdmin()) || (t.only === 'developer' && this.isDeveloper()),
    ),
  );

  /** Progress summary (overall %, working days) — `ProjectProgress/{id}/summary`. */
  protected readonly summary = signal<ProjectProgressSummaryDto | null>(null);
  /** THE project progress — shared with the projects table and updated live. */
  protected readonly progressPercent = computed(() => {
    const p = this.project();
    const live = this.progressSync.percents()[this.projectId];
    return live ?? this.summary()?.overallProgressPercentage ?? (p ? this.progressSync.percentFor(p) : 0);
  });

  private readonly queryTab = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), {
    initialValue: this.route.snapshot.queryParamMap.get('tab'),
  });
  protected readonly tab = computed<WorkspaceTab>(() => {
    const wanted = this.queryTab();
    // Old links: ?tab=builds / ?tab=settings.
    const legacy: Record<string, WorkspaceTab> = { builds: 'deliverables', settings: 'client' };
    const id = (wanted && legacy[wanted]) || wanted;
    return this.tabs().some((t) => t.id === id) ? (id as WorkspaceTab) : 'overview';
  });

  protected readonly statusClass = projectStatusBadgeClass;
  protected readonly backLink = computed(() => (this.isAdmin() ? '/ProjectManage' : '/developer-dashboard'));

  constructor() {
    this.loadProject();
    this.loadSummary();
    // The tab badge: what needs the viewer (Admin: a decision; developer: newly approved).
    this.requestsApi
      .list(this.projectId, { status: this.isAdmin() ? 'PendingReview' : 'Open', pageSize: 1 })
      .pipe(catchError(() => of(null)), takeUntilDestroyed())
      .subscribe((page) => this.openRequests.set(page?.count ?? 0));
  }

  protected selectTab(id: WorkspaceTab): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'overview' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected loadSummary(): void {
    this.progressApi
      .getSummary(this.projectId, true)
      .pipe(catchError(() => of(null)))
      .subscribe((s) => {
        this.summary.set(s);
        if (s) this.progressSync.set(this.projectId, s.overallProgressPercentage);
      });
  }

  /** Re-read the header after team / client-link changes. */
  protected loadProject(): void {
    const load$ = this.isAdmin()
      ? this.projectsApi.getById(this.projectId)
      : this.projectsApi.myGetById(this.projectId);
    load$.pipe(catchError(() => of(null))).subscribe((p) => {
      this.loading.set(false);
      if (p) this.project.set(p);
      else if (!this.project()) this.failed.set(true);
    });
  }
}
