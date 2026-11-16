import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { PagedResult, TaskListItem, projectPriorityBadgeClass, taskStatusBadgeClass } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TasksService } from '../../../ProjectsTasks/services/tasks.service';

const PAGE_SIZE = 50;

/**
 * The project's tasks at a glance (admin: all; developer: their own).
 * Creating / editing tasks stays on the tasks page — linked from here.
 */
@Component({
  selector: 'app-project-tasks-panel',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-tasks-panel.component.html',
  styleUrl: './project-tasks-panel.component.scss',
})
export class ProjectTasksPanelComponent {
  private readonly tasks = inject(TasksService);

  readonly projectId = input.required<number>();
  readonly isAdmin = input(false);

  protected readonly rows = signal<TaskListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  protected readonly statusClass = taskStatusBadgeClass;
  protected readonly priorityClass = projectPriorityBadgeClass;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const query = { ProjectId: this.projectId(), PageIndex: 1, PageSize: PAGE_SIZE };
    const call$: Observable<PagedResult<TaskListItem>> = this.isAdmin()
      ? this.tasks.list(query, true)
      : this.tasks.myList(query, true);
    call$.subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.total.set(page.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected assignees(t: TaskListItem): string {
    return t.assignees?.map((a) => a.fullName).join('، ') || '—';
  }

  protected isOverdue(t: TaskListItem): boolean {
    return t.status !== 'Completed' && !!t.dueDate && Date.parse(t.dueDate) < Date.now();
  }
}
