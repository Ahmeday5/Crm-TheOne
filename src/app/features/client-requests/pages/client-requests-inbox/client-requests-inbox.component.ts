import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, debounceTime, distinctUntilChanged, map, of, skip } from 'rxjs';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RefreshButtonComponent } from '../../../../shared/components/refresh-button/refresh-button.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { RequestTargetChipComponent } from '../../../client-portal/components/request-target-chip/request-target-chip.component';
import { StaffRequestDialogComponent } from '../../../client-portal/components/staff-request-dialog/staff-request-dialog.component';
import {
  ClientRequestDetails,
  ClientRequestListItem,
  REQUEST_TARGETS,
  RequestStatus,
  RequestTarget,
  isTriageStatus,
} from '../../../client-portal/models/client-portal.models';
import { requestPriorityClass, requestStatusClass, requestTypeIcon } from '../../../client-portal/utils/client-portal-ui.util';
import { targetIcon } from '../../../client-portal/utils/request-target.util';
import { RequestReviewDialogComponent } from '../../components/request-review-dialog/request-review-dialog.component';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../../data/staff-client-requests.gateway';
import { InboxQuery, InboxSort } from '../../models/client-requests.models';
import { ClientRequestsInboxStore } from '../../state/client-requests-inbox.store';

type Tab = 'PendingReview' | 'NeedsClarification' | 'Open' | 'Rejected' | 'all';

interface TabDef {
  id: Tab;
  icon: string;
  count: () => number | null;
}

const PAGE_SIZE = 20;

/**
 * `/client-requests` — the Admin's single queue of client requests across all
 * projects. Opens on "waiting for your decision", oldest first (nobody waits
 * forever); one click opens the review with approve / ask / decline.
 */
@Component({
  selector: 'app-client-requests-inbox',
  standalone: true,
  imports: [
    PageHeaderComponent,
    MockRibbonComponent,
    RefreshButtonComponent,
    TranslatePipe,
    TimeAgoPipe,
    RequestTargetChipComponent,
    RequestReviewDialogComponent,
    StaffRequestDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-requests-inbox.component.html',
  styleUrl: './client-requests-inbox.component.scss',
})
export class ClientRequestsInboxComponent {
  private readonly api = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly store = inject(ClientRequestsInboxStore);
  private readonly projects = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summary = this.store.summary;
  protected readonly targets = REQUEST_TARGETS;
  protected readonly targetIcon = targetIcon;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly statusClass = requestStatusClass;
  protected readonly priorityClass = requestPriorityClass;

  protected readonly tabs: TabDef[] = [
    { id: 'PendingReview', icon: 'fa-solid fa-hourglass-half', count: () => this.summary().pendingReview },
    { id: 'NeedsClarification', icon: 'fa-solid fa-user-clock', count: () => this.summary().needsClarification },
    { id: 'Open', icon: 'fa-solid fa-circle-check', count: () => null },
    { id: 'Rejected', icon: 'fa-solid fa-ban', count: () => null },
    { id: 'all', icon: 'fa-solid fa-layer-group', count: () => null },
  ];

  // ── filters ──
  protected readonly tab = signal<Tab>('PendingReview');
  protected readonly search = signal('');
  protected readonly projectId = signal<number | null>(null);
  protected readonly target = signal<RequestTarget | null>(null);
  protected readonly sort = signal<InboxSort | null>(null);
  protected readonly projectOptions = signal<{ id: number; title: string }[]>([]);

  // ── data ──
  protected readonly rows = signal<ClientRequestListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);

  // ── dialogs ──
  protected readonly reviewId = signal<number | null>(null);
  protected readonly teamRequest = signal<{ projectId: number; id: number } | null>(null);

  protected readonly hasFilters = computed(() => !!this.search().trim() || this.projectId() != null || this.target() != null);
  protected readonly hasMore = computed(() => this.rows().length < this.total());
  protected readonly effectiveSort = computed<InboxSort>(() => this.sort() ?? (this.tab() === 'PendingReview' ? 'oldest' : 'newest'));

  private inFlight: Subscription | null = null;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const initialTab = q.get('tab') as Tab | null;
    if (initialTab && this.tabs.some((t) => t.id === initialTab)) this.tab.set(initialTab);

    this.load();
    this.loadProjects();

    // Typing pauses → search (other filters apply at once).
    toObservable(this.search)
      .pipe(skip(1), map((s) => s.trim()), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());

    // Something changed elsewhere (client answered, another Admin acted) → refresh quietly.
    this.store.changed$.pipe(debounceTime(400), takeUntilDestroyed()).subscribe(() => this.load(true));
  }

  protected setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.sort.set(null);
    this.syncUrl({ tab: tab === 'PendingReview' ? null : tab });
    this.load();
  }

  protected setProject(value: string): void {
    this.projectId.set(value ? Number(value) : null);
    this.load();
  }

  protected setTarget(value: string): void {
    this.target.set((value as RequestTarget) || null);
    this.load();
  }

  protected toggleSort(): void {
    this.sort.set(this.effectiveSort() === 'oldest' ? 'newest' : 'oldest');
    this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.projectId.set(null);
    this.target.set(null);
    this.load();
  }

  protected refreshAll(): void {
    this.store.refresh();
    this.load();
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = this.pageIndex() + 1;
    this.api.inbox(this.query(next)).subscribe({
      next: (page) => {
        this.rows.update((list) => [...list, ...(page.data ?? [])]);
        this.total.set(page.count ?? 0);
        this.pageIndex.set(next);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  protected open(r: ClientRequestListItem): void {
    if (isTriageStatus(r.status)) {
      this.reviewId.set(r.id);
    } else {
      this.teamRequest.set({ projectId: r.projectId, id: r.id });
    }
  }

  protected closeReview(): void {
    this.reviewId.set(null);
  }

  /** A decision moves the row out of the current tab — drop it (the badge refreshes by itself). */
  protected onUpdated(r: ClientRequestDetails): void {
    const tab = this.tab();
    const stays = tab === 'all' ? r.status !== 'Rejected' : r.status === tab;
    this.rows.update((list) =>
      stays ? list.map((x) => (x.id === r.id ? { ...x, ...toRow(r) } : x)) : list.filter((x) => x.id !== r.id),
    );
    if (!stays) this.total.update((n) => Math.max(0, n - 1));
  }

  /** Pending and the client answered our question (the row to look at first). */
  protected clientAnswered(r: ClientRequestListItem): boolean {
    return r.status === 'PendingReview' && !!r.clientRepliedAt;
  }

  private load(quiet = false): void {
    this.inFlight?.unsubscribe();
    if (!quiet) this.loading.set(true);
    this.loadFailed.set(false);
    this.inFlight = this.api.inbox(this.query(1)).subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.total.set(page.count ?? 0);
        this.pageIndex.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!quiet) this.loadFailed.set(true);
      },
    });
  }

  private query(pageIndex: number): InboxQuery {
    const tab = this.tab();
    return {
      status: tab === 'all' ? null : (tab as RequestStatus),
      projectId: this.projectId(),
      target: this.target(),
      search: this.search().trim() || null,
      sort: this.effectiveSort(),
      pageIndex,
      pageSize: PAGE_SIZE,
    };
  }

  private loadProjects(): void {
    this.projects
      .list({ PageIndex: 1, PageSize: 200 })
      .pipe(
        map((page) => (page.data ?? []).map((p) => ({ id: p.id, title: p.title }))),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.projectOptions.set(list));
  }

  private syncUrl(params: Record<string, string | number | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

function toRow(r: ClientRequestDetails): Partial<ClientRequestListItem> {
  return {
    title: r.title,
    status: r.status,
    priority: r.priority,
    type: r.type,
    target: r.target,
    surfaceId: r.surfaceId,
    appAudience: r.appAudience,
    appName: r.appName,
    appPlatform: r.appPlatform,
    targetLabel: r.targetLabel,
    awaitingParty: r.awaitingParty,
    clientRepliedAt: r.clientRepliedAt,
    assignedToName: r.assignedToName,
    commentsCount: r.commentsCount,
    updatedAt: r.updatedAt,
  };
}
