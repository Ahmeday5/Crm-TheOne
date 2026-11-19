import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestReviewDialogComponent } from '../../../client-requests/components/request-review-dialog/request-review-dialog.component';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../../../client-requests/data/staff-client-requests.gateway';
import { ClientRequestsInboxStore } from '../../../client-requests/state/client-requests-inbox.store';
import {
  ClientRequestDetails,
  ClientRequestListItem,
  RequestStatus,
  TEAM_STATUSES,
  isTriageStatus,
} from '../../models/client-portal.models';
import { requestPriorityClass, requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';
import { RequestTargetChipComponent } from '../request-target-chip/request-target-chip.component';
import { StaffRequestDialogComponent } from '../staff-request-dialog/staff-request-dialog.component';

type Filter = RequestStatus | 'all';

/** Admin: the gate first, then the team flow. Developers never get triage statuses (server-side). */
const ADMIN_STATUSES: ReadonlyArray<RequestStatus> = ['PendingReview', 'NeedsClarification', ...TEAM_STATUSES];

/**
 * "طلبات العميل" tab of the project workspace. Status chips with counts —
 * opens on what needs the viewer (Admin: waiting for a decision; developer:
 * newly approved). A triage row opens the Admin review, an approved row the
 * team dialog — only ever on the user's click. Live: refreshes the list
 * when anything changes for this project (never opens a dialog by itself).
 */
@Component({
  selector: 'app-client-requests-panel',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, StaffRequestDialogComponent, RequestReviewDialogComponent, RequestTargetChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-requests-panel.component.html',
  styleUrl: './client-requests-panel.component.scss',
})
export class ClientRequestsPanelComponent {
  private readonly api = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly inbox = inject(ClientRequestsInboxStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<number>();
  readonly isAdmin = input(false);
  /** What needs the viewer — the workspace shows it on the tab. */
  readonly openCount = output<number>();

  protected readonly items = signal<ClientRequestListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly filter = signal<Filter | null>(null);
  protected readonly openRow = signal<ClientRequestListItem | null>(null);

  protected readonly statuses = computed(() => (this.isAdmin() ? ADMIN_STATUSES : TEAM_STATUSES));
  /** The status that needs this viewer. */
  private readonly focusStatus = computed<RequestStatus>(() => (this.isAdmin() ? 'PendingReview' : 'Open'));

  protected readonly counts = computed(() => {
    const c: Partial<Record<string, number>> = { all: this.items().length };
    for (const r of this.items()) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  });
  protected readonly activeFilter = computed<Filter>(() => {
    const f = this.filter();
    if (f) return f;
    return this.counts()[this.focusStatus()] ? this.focusStatus() : 'all';
  });
  protected readonly rows = computed(() => {
    const f = this.activeFilter();
    return f === 'all' ? this.items() : this.items().filter((r) => r.status === f);
  });

  protected readonly statusClass = requestStatusClass;
  protected readonly priorityClass = requestPriorityClass;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly isTriage = isTriageStatus;

  ngOnInit(): void {
    this.load();
    this.inbox.changed$
      .pipe(
        filter((pid) => pid === null || pid === this.projectId()),
        debounceTime(400),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.load(true));
  }

  protected load(quiet = false): void {
    if (!quiet) this.loading.set(true);
    this.loadFailed.set(false);
    this.api.list(this.projectId()).subscribe({
      next: (page) => {
        this.items.set(page.data ?? []);
        this.loading.set(false);
        this.emitCount();
      },
      error: () => {
        this.loading.set(false);
        if (!quiet) this.loadFailed.set(true);
      },
    });
  }

  protected open(r: ClientRequestListItem): void {
    this.openRow.set(r);
  }

  protected onUpdated(r: ClientRequestDetails): void {
    this.items.update((list) =>
      list.map((x) =>
        x.id === r.id
          ? {
              ...x,
              title: r.title,
              type: r.type,
              status: r.status,
              priority: r.priority,
              target: r.target,
              surfaceId: r.surfaceId,
              appAudience: r.appAudience,
              appName: r.appName,
              appPlatform: r.appPlatform,
              targetLabel: r.targetLabel,
              awaitingParty: r.awaitingParty,
              clientRepliedAt: r.clientRepliedAt,
              assignedToId: r.assignedToId,
              assignedToName: r.assignedToName,
              commentsCount: r.commentsCount,
              updatedAt: r.updatedAt,
            }
          : x,
      ),
    );
    // Declined requests leave the project's list.
    if (r.status === 'Rejected') this.items.update((list) => list.filter((x) => x.id !== r.id));
    this.emitCount();
  }

  private emitCount(): void {
    const focus = this.focusStatus();
    this.openCount.emit(this.items().filter((r) => r.status === focus).length);
  }
}
