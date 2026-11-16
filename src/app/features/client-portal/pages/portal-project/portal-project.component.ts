import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { projectStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { timelineIcon } from '../../../project-workspace/components/project-timeline/project-timeline.component';
import { NewRequestDialogComponent } from '../../components/new-request-dialog/new-request-dialog.component';
import {
  ClientProjectDetails,
  ClientRequestDetails,
  ClientRequestListItem,
  TimelineEvent,
  isRequestOpen,
} from '../../models/client-portal.models';
import { ClientPortalService } from '../../services/client-portal.service';
import { requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';

/**
 * One project, as its owner sees it: a big progress ring + status, the plan as
 * a vertical stepper, the expected date, ONE obvious action ("عندي مشكلة /
 * طلب تعديل"), their requests and the latest news.
 */
@Component({
  selector: 'app-portal-project',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe, NewRequestDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-project.component.html',
  styleUrl: './portal-project.component.scss',
})
export class PortalProjectComponent {
  private readonly api = inject(ClientPortalService);
  private readonly router = inject(Router);

  protected readonly projectId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || 0;

  protected readonly project = signal<ClientProjectDetails | null>(null);
  protected readonly failed = signal(false);
  protected readonly requests = signal<ClientRequestListItem[] | null>(null);
  protected readonly news = signal<TimelineEvent[]>([]);
  protected readonly composerOpen = signal(false);

  protected readonly doneCount = computed(() => this.project()?.milestones.filter((m) => m.status === 'Done').length ?? 0);
  protected readonly openCount = computed(() => (this.requests() ?? []).filter((r) => isRequestOpen(r.status)).length);

  protected readonly statusClass = projectStatusBadgeClass;
  protected readonly requestStatusClass = requestStatusClass;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly newsIcon = timelineIcon;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.api.project(this.projectId).subscribe({
      next: (p) => this.project.set(p),
      error: () => this.failed.set(true),
    });
    this.api
      .requests(this.projectId)
      .pipe(catchError(() => of(null)))
      .subscribe((page) => this.requests.set(page?.data ?? []));
    this.api
      .timeline(this.projectId, 1, 6)
      .pipe(catchError(() => of(null)))
      .subscribe((page) => this.news.set(page?.data ?? []));
  }

  protected onCreated(r: ClientRequestDetails): void {
    this.composerOpen.set(false);
    this.router.navigate(['/portal', 'requests', r.id]);
  }
}
