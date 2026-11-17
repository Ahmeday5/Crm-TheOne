import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProgressRingComponent } from '../../../../shared/components/progress-ring/progress-ring.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { timelineIcon } from '../../../project-workspace/components/project-timeline/project-timeline.component';
import { NewRequestDialogComponent } from '../../components/new-request-dialog/new-request-dialog.component';
import { PortalCredentialsComponent } from '../../components/portal-credentials/portal-credentials.component';
import { PortalProgressChartComponent } from '../../components/portal-progress-chart/portal-progress-chart.component';
import { PortalReleasesComponent } from '../../components/portal-releases/portal-releases.component';
import { CLIENT_PORTAL_GATEWAY } from '../../data/client-portal.gateway';
import {
  ClientCredential,
  ClientProjectDetails,
  ClientRelease,
  ClientRequestDetails,
  ClientRequestListItem,
  TimelineEvent,
  isRequestOpen,
} from '../../models/client-portal.models';
import { waHref } from '../../services/portal-branding.service';
import { PortalLiveService } from '../../services/portal-live.service';
import { healthIcon, healthTone, requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';

interface SectionLink {
  id: string;
  labelKey: string;
  icon: string;
}

/**
 * One project, as its owner sees it: hero (live progress ring, schedule
 * health, dates, project manager), progress over time, the plan, "try the
 * system" (credentials), "download the app" (APK + QR), requests and news.
 * A section switcher keeps the project workspace focused; on phones a bottom
 * action bar keeps "new request" / "download app" one tap away.
 */
@Component({
  selector: 'app-portal-project',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    TimeAgoPipe,
    NewRequestDialogComponent,
    ProgressRingComponent,
    UserAvatarComponent,
    PortalProgressChartComponent,
    PortalCredentialsComponent,
    PortalReleasesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-project.component.html',
  styleUrl: './portal-project.component.scss',
})
export class PortalProjectComponent {
  private readonly api = inject(CLIENT_PORTAL_GATEWAY);
  private readonly router = inject(Router);
  private readonly live = inject(PortalLiveService);

  protected readonly projectId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || 0;

  protected readonly project = signal<ClientProjectDetails | null>(null);
  protected readonly failed = signal(false);
  protected readonly requests = signal<ClientRequestListItem[] | null>(null);
  protected readonly news = signal<TimelineEvent[]>([]);
  protected readonly credentials = signal<ClientCredential[]>([]);
  protected readonly releases = signal<ClientRelease[]>([]);
  protected readonly composerOpen = signal(false);
  protected readonly activeSection = signal('overview');
  /** Flashes the ring when a live update lands. */
  protected readonly pulse = signal(false);

  protected readonly doneCount = computed(() => this.project()?.milestones.filter((m) => m.status === 'Done').length ?? 0);
  protected readonly planPercent = computed(() => {
    const p = this.project();
    return p?.milestones.length ? Math.round((this.doneCount() / p.milestones.length) * 100) : 0;
  });
  protected readonly openCount = computed(() => (this.requests() ?? []).filter((r) => isRequestOpen(r.status)).length);
  protected readonly androidLatest = computed(() => this.releases().find((r) => r.isLatest && r.platform === 'Android' && r.hasFile) ?? null);
  protected readonly managerWa = computed(() => {
    const p = this.project();
    return p?.projectManager?.whatsApp ? waHref(p.projectManager.whatsApp, p.name) : null;
  });

  protected readonly sections = computed<SectionLink[]>(() => {
    const list: SectionLink[] = [
      { id: 'overview', labelKey: 'portal.project.nav.overview', icon: 'fa-solid fa-gauge' },
      { id: 'plan', labelKey: 'portal.project.nav.plan', icon: 'fa-solid fa-flag-checkered' },
    ];
    if (this.credentials().length) list.push({ id: 'try', labelKey: 'portal.project.nav.try', icon: 'fa-solid fa-display' });
    if (this.releases().length) list.push({ id: 'app', labelKey: 'portal.project.nav.app', icon: 'fa-solid fa-mobile-screen' });
    list.push({ id: 'requests', labelKey: 'portal.project.nav.requests', icon: 'fa-solid fa-message' });
    if (this.news().length) list.push({ id: 'news', labelKey: 'portal.project.nav.news', icon: 'fa-solid fa-newspaper' });
    return list;
  });

  protected readonly statusClass = projectStatusBadgeClass;
  protected readonly requestStatusClass = requestStatusClass;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly newsIcon = timelineIcon;
  protected readonly healthTone = healthTone;
  protected readonly healthIcon = healthIcon;

  constructor() {
    this.load();

    this.live
      .progressFor(this.projectId)
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        this.project.update((p) => (p ? { ...p, progressPercent: e.progressPercent, status: e.status, lastUpdateAt: e.changedAt } : p));
        this.pulse.set(true);
        setTimeout(() => this.pulse.set(false), 1200);
      });
    this.live
      .changesFor(this.projectId)
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e.kind === 'milestone') this.loadProject();
        if (e.kind === 'release') this.loadReleases();
        if (e.kind === 'request') this.loadRequests();
        this.loadNews();
      });

  }

  protected load(): void {
    this.failed.set(false);
    this.loadProject();
    this.loadRequests();
    this.loadNews();
    this.api.credentials(this.projectId).pipe(catchError(() => of([]))).subscribe((list) => this.credentials.set(list));
    this.loadReleases();
  }

  protected selectSection(id: string): void {
    if (!this.sections().some((section) => section.id === id)) return;
    this.activeSection.set(id);
  }

  protected downloadLatestApk(): void {
    this.selectSection('app');
  }

  protected onCreated(r: ClientRequestDetails): void {
    this.composerOpen.set(false);
    this.router.navigate(['/portal', 'requests', r.id]);
  }

  private loadProject(): void {
    this.api.project(this.projectId).subscribe({
      next: (p) => this.project.set(p),
      error: () => this.failed.set(true),
    });
  }

  private loadRequests(): void {
    this.api
      .requests(this.projectId, {})
      .pipe(catchError(() => of(null)))
      .subscribe((page) => this.requests.set(page?.data ?? []));
  }

  private loadNews(): void {
    this.api
      .timeline(this.projectId, 1, 6)
      .pipe(catchError(() => of(null)))
      .subscribe((page) => this.news.set(page?.data ?? []));
  }

  private loadReleases(): void {
    this.api.releases(this.projectId).pipe(catchError(() => of([]))).subscribe((list) => this.releases.set(list));
  }
}
