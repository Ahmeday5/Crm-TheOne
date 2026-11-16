import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../../project-progress/services/project-progress.service';
import { ProjectWorkspaceService } from '../../../project-workspace/services/project-workspace.service';
import {
  ClientRequestDetails,
  ClientRequestListItem,
  REQUEST_STATUSES,
  RequestStatus,
} from '../../models/client-portal.models';
import { ClientRequestsStaffService, StaffOption } from '../../services/client-requests-staff.service';
import { requestPriorityClass, requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';
import { StaffRequestDialogComponent } from '../staff-request-dialog/staff-request-dialog.component';

type Filter = RequestStatus | 'all';

/**
 * "طلبات العميل" tab of the project workspace: status filter chips with
 * counts (Open first — what needs the team), click a row to answer / triage.
 */
@Component({
  selector: 'app-client-requests-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, StaffRequestDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-requests-panel.component.html',
  styleUrl: './client-requests-panel.component.scss',
})
export class ClientRequestsPanelComponent {
  private readonly api = inject(ClientRequestsStaffService);
  private readonly workspace = inject(ProjectWorkspaceService);
  private readonly progress = inject(ProjectProgressService);

  readonly projectId = input.required<number>();
  readonly isAdmin = input(false);
  /** `Open` count — the workspace shows it on the tab. */
  readonly openCount = output<number>();

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly items = signal<ClientRequestListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly filter = signal<Filter>('Open');
  protected readonly openId = signal<number | null>(null);
  protected readonly assignees = signal<StaffOption[]>([]);

  protected readonly counts = computed(() => {
    const c: Partial<Record<string, number>> = { all: this.items().length };
    for (const r of this.items()) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  });
  protected readonly rows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.items() : this.items().filter((r) => r.status === f);
  });

  protected readonly statusClass = requestStatusClass;
  protected readonly priorityClass = requestPriorityClass;
  protected readonly typeIcon = requestTypeIcon;

  ngOnInit(): void {
    this.load();
    this.loadAssignees();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.list(this.projectId()).subscribe({
      next: (page) => {
        const list = page.data ?? [];
        this.items.set(list);
        this.loading.set(false);
        // Nothing open → show everything instead of an empty "Open" view.
        if (!list.some((r) => r.status === 'Open') && this.filter() === 'Open') this.filter.set('all');
        this.emitOpen();
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected onUpdated(r: ClientRequestDetails): void {
    this.items.update((list) =>
      list.map((x) =>
        x.id === r.id
          ? {
              ...x,
              status: r.status,
              priority: r.priority,
              assignedToId: r.assignedToId,
              assignedToName: r.assignedToName,
              commentsCount: r.commentsCount,
              updatedAt: r.updatedAt,
            }
          : x,
      ),
    );
    this.emitOpen();
  }

  private emitOpen(): void {
    this.openCount.emit(this.items().filter((r) => r.status === 'Open').length);
  }

  /** Project developers (+ admins) — who a request can be assigned to. */
  private loadAssignees(): void {
    const devs$ = this.isAdmin()
      ? this.workspace.developers(this.projectId()).pipe(
          map((list) => list.map((d) => ({ userId: d.developerId, fullName: d.developerName ?? '—' }))),
        )
      : this.progress.getTeam(this.projectId()).pipe(
          map((list) => list.map((m) => ({ userId: m.developerId, fullName: m.developerName ?? '—' }))),
        );
    forkJoin([devs$.pipe(catchError(() => of([]))), this.api.admins().pipe(catchError(() => of([])))]).subscribe(
      ([devs, admins]) => {
        const seen = new Set<string>();
        this.assignees.set(
          [...devs, ...admins.map((a) => ({ userId: a.userId, fullName: a.fullName }))].filter(
            (o) => !!o.userId && !seen.has(o.userId) && !!seen.add(o.userId),
          ),
        );
      },
    );
  }
}
