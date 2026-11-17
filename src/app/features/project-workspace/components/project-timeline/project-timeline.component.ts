import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TimelineEvent, TimelineEventType } from '../../models/workspace.models';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';

const PAGE_SIZE = 10;

export function timelineIcon(type: TimelineEventType): string {
  switch (type) {
    case 'MilestoneCompleted': return 'fa-solid fa-flag-checkered';
    case 'MilestoneAdded': return 'fa-solid fa-flag';
    case 'MilestoneStatusChanged': return 'fa-solid fa-list-check';
    case 'ReleasePublished': return 'fa-solid fa-rocket';
    case 'CredentialAdded':
    case 'CredentialUpdated': return 'fa-solid fa-key';
    case 'StatusChanged': return 'fa-solid fa-arrows-rotate';
    case 'RequestCreated': return 'fa-solid fa-message';
    case 'RequestStatusChanged': return 'fa-solid fa-comment-dots';
    default: return 'fa-solid fa-circle-info';
  }
}

/** The project's activity, newest first; marks what the client also sees. */
@Component({
  selector: 'app-project-timeline',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card h-100">
      <div class="card-header d-flex align-items-center gap-2">
        <i class="fa-solid fa-clock-rotate-left text-primary" aria-hidden="true"></i>
        <h5 class="mb-0">{{ 'projectWorkspace.timeline' | translate }}</h5>
      </div>
      <div class="card-body py-2">
        @if (loading() && !items().length) {
          <div class="d-flex justify-content-center py-4"><span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span></div>
        } @else if (loadFailed()) {
          <p class="text-muted small my-3">{{ 'projectWorkspace.loadFailedSection' | translate }}
            <button type="button" class="btn btn-link btn-sm p-0" (click)="load(1)">{{ 'common.retry' | translate }}</button></p>
        } @else if (!items().length) {
          <p class="text-muted small my-3">{{ 'projectWorkspace.noActivity' | translate }}</p>
        } @else {
          <ul class="tl" role="list">
            @for (e of items(); track e.id) {
              <li>
                <span class="tl__icon" [attr.data-type]="e.type"><i [class]="icon(e.type)" aria-hidden="true"></i></span>
                <span class="tl__main">
                  <span class="tl__title">{{ e.title }}</span>
                  @if (e.description) { <span class="tl__desc">{{ e.description }}</span> }
                  <span class="tl__meta">
                    {{ e.createdAt | cairoDate }}
                    @if (e.isClientVisible) { <span class="tl__client"><i class="fa-solid fa-eye" aria-hidden="true"></i>{{ 'projectWorkspace.clientVisible' | translate }}</span> }
                  </span>
                </span>
              </li>
            }
          </ul>
          @if (hasMore()) {
            <button type="button" class="btn btn-sm btn-light w-100 mb-2" [disabled]="loading()" (click)="load(page() + 1)">
              {{ 'common.loadMore' | translate }}
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .tl { margin: 0; padding: 0; list-style: none; }
    .tl li { display: flex; gap: 0.7rem; padding: 0.65rem 0; }
    .tl li + li { border-top: 1px solid var(--border); }
    .tl__icon {
      display: grid; place-items: center; width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%;
      background: var(--brand-soft); color: var(--brand-500); font-size: 0.8rem;
    }
    .tl__icon[data-type='MilestoneCompleted'] { background: var(--success-subtle, #dcfce7); color: var(--success); }
    .tl__icon[data-type='RequestCreated'] { background: var(--warning-subtle, #fef3c7); color: var(--warning); }
    .tl__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .tl__title { font-size: var(--fs-sm); font-weight: var(--fw-600); }
    .tl__desc { font-size: var(--fs-xs); color: var(--text-2); }
    .tl__meta { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: var(--fs-xs); color: var(--text-3); }
    .tl__client { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--info); font-weight: var(--fw-600); }
  `,
})
export class ProjectTimelineComponent {
  private readonly api = inject(ProjectWorkspaceService);

  readonly projectId = input.required<number>();

  protected readonly items = signal<TimelineEvent[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly hasMore = computed(() => this.items().length < this.total());
  protected readonly icon = timelineIcon;

  ngOnInit(): void {
    this.load(1);
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.timeline(this.projectId(), page, PAGE_SIZE).subscribe({
      next: (res) => {
        const data = res.data ?? [];
        this.items.update((list) => (page === 1 ? data : [...list, ...data.filter((e) => !list.some((x) => x.id === e.id))]));
        this.total.set(res.count ?? 0);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(page === 1);
      },
    });
  }
}
