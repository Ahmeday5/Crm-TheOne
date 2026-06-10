import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ExportColumn } from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  DataTableComponent,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  FormMode,
  PROJECT_PRIORITY_OPTIONS,
  ProjectPriorityName,
  TASK_STATUSES,
  TaskListItem,
  TaskListQuery,
  TaskStatusName,
  projectPriorityBadgeClass,
  taskCategoryBadgeClass,
  taskStatusBadgeClass,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TaskDetailsDialogComponent } from '../../components/task-details-dialog/task-details-dialog.component';
import { TaskFormDialogComponent } from '../../components/task-form-dialog/task-form-dialog.component';
import { TaskStatusDialogComponent } from '../../components/task-status-dialog/task-status-dialog.component';
import { ProjectsService } from '../../services/projects.service';
import { TasksService } from '../../services/tasks.service';

interface ProjectFilterOption {
  id: number;
  title: string;
}

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-tasks-manage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    DataTableComponent,
    LoadErrorComponent,
    PaginationComponent,
    TableToolsComponent,
    TaskFormDialogComponent,
    TaskDetailsDialogComponent,
    TaskStatusDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks-manage.component.html',
  styleUrl: './tasks-manage.component.scss',
})
export class TasksManageComponent implements OnInit, OnDestroy {
  private readonly tasks = inject(TasksService);
  private readonly projects = inject(ProjectsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  readonly statuses = TASK_STATUSES;
  readonly priorities = PROJECT_PRIORITY_OPTIONS;

  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  /** Filters. `null` ⇒ "all". */
  readonly projectFilter = signal<number | null>(null);
  readonly statusFilter = signal<TaskStatusName | null>(null);
  readonly priorityFilter = signal<ProjectPriorityName | null>(null);

  readonly projectOptions = signal<ProjectFilterOption[]>([]);

  readonly rows = signal<TaskListItem[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly searchSignal = signal('');

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly dialogMode = signal<FormMode | null>(null);
  readonly editing = signal<TaskListItem | null>(null);
  readonly viewingId = signal<number | null>(null);
  readonly statusEditing = signal<TaskListItem | null>(null);

  readonly busyId = signal<number | null>(null);

  readonly statusBadge = taskStatusBadgeClass;
  readonly priorityBadge = projectPriorityBadgeClass;
  readonly categoryBadge = taskCategoryBadgeClass;

  // ── cell templates ──
  private readonly titleCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('titleCell');
  private readonly assigneesCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('assigneesCell');
  private readonly priorityCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('priorityCell');
  private readonly statusCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('statusCell');
  private readonly categoryCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('categoryCell');
  private readonly dueCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('dueCell');
  private readonly hoursCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('hoursCell');
  private readonly createdCell =
    viewChild<TemplateRef<{ $implicit: TaskListItem }>>('createdCell');

  readonly columns = computed<ReadonlyArray<TableColumn<TaskListItem>>>(() => [
    {
      key: 'title',
      label: 'projects.tasksManage.table.task',
      i18nLabel: true,
      cellTemplate: this.titleCell(),
    },
    { key: 'projectName', label: 'projects.tasksManage.table.project', i18nLabel: true },
    {
      key: 'assignees',
      label: 'projects.tasksManage.table.assignee',
      i18nLabel: true,
      cellTemplate: this.assigneesCell(),
    },
    {
      key: 'priority',
      label: 'projects.tasksManage.table.priority',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.priorityCell(),
    },
    {
      key: 'status',
      label: 'projects.tasksManage.table.status',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.statusCell(),
    },
    {
      key: 'category',
      label: 'projects.tasksManage.table.category',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.categoryCell(),
    },
    {
      key: 'dueDate',
      label: 'projects.tasksManage.table.dueDate',
      i18nLabel: true,
      cellTemplate: this.dueCell(),
    },
    {
      key: 'estimatedHours',
      label: 'projects.tasksManage.table.hours',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.hoursCell(),
    },
    {
      key: 'createdByName',
      label: 'projects.tasksManage.table.createdBy',
      i18nLabel: true,
      cellTemplate: this.createdCell(),
    },
  ]);

  // ─────────── export ───────────

  get exportColumns(): ExportColumn<TaskListItem>[] {
    return [
      { header: this.t('projects.tasksManage.table.task'), value: (r) => r.title },
      { header: this.t('projects.tasksManage.table.project'), value: (r) => r.projectName },
      {
        header: this.t('projects.tasksManage.table.assignee'),
        value: (r) => r.assignees.map((a) => a.fullName).join(', ') || '—',
      },
      {
        header: this.t('projects.tasksManage.table.priority'),
        value: (r) => this.t('projects.manage.priorities.' + r.priority),
      },
      {
        header: this.t('projects.tasksManage.table.status'),
        value: (r) => this.t('projects.tasksManage.statuses.' + r.status),
      },
      {
        header: this.t('projects.tasksManage.table.category'),
        value: (r) => this.t('projects.tasksManage.categories.' + r.category),
      },
      {
        header: this.t('projects.tasksManage.table.dueDate'),
        value: (r) => this.formatDate(r.dueDate),
      },
      {
        header: this.t('projects.tasksManage.table.hours'),
        value: (r) => `${r.actualHours ?? '—'} / ${r.estimatedHours}h`,
      },
      {
        header: this.t('projects.tasksManage.table.createdBy'),
        value: (r) => r.createdByName || '—',
      },
      { header: 'Created at', value: (r) => this.formatDate(r.createdAt) },
      { header: 'Completed at', value: (r) => this.formatDate(r.completedAt) },
      { header: 'Tags', value: (r) => r.tags || '—' },
    ];
  }

  readonly fetchAllRows = async (): Promise<TaskListItem[]> => {
    const page = await firstValueFrom(
      this.fetch({ ...this.buildQuery(), PageIndex: 1, PageSize: this.count() || this.pageSize() }),
    );
    return page.data ?? [];
  };

  ngOnInit(): void {
    this.loadProjectOptions();
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data ───────────

  private fetch(query: TaskListQuery, force = false) {
    return this.isAdmin() ? this.tasks.list(query, force) : this.tasks.myList(query, force);
  }

  private buildQuery(): TaskListQuery {
    return {
      Search: this.searchSignal().trim() || undefined,
      ProjectId: this.projectFilter() ?? undefined,
      Status: this.statusFilter() ?? undefined,
      Priority: this.priorityFilter() ?? undefined,
    };
  }

  private loadProjectOptions(): void {
    const source$ = this.isAdmin()
      ? this.projects.list({ PageIndex: 1, PageSize: 1000 })
      : this.projects.myList({ PageIndex: 1, PageSize: 1000 });
    source$.subscribe({
      next: (page) =>
        this.projectOptions.set(
          (page.data ?? []).map((p) => ({ id: p.id, title: p.title })),
        ),
      error: () => this.projectOptions.set([]),
    });
  }

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.fetch(
      {
        ...this.buildQuery(),
        PageIndex: this.pageIndex(),
        PageSize: this.pageSize(),
      },
      force,
    ).subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.count.set(page.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('projects.tasksManage.messages.loadFailed'));
      },
    });
  }

  // ─────────── filters / search / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onProjectFilter(value: string): void {
    this.projectFilter.set(value ? Number(value) : null);
    this.pageIndex.set(1);
    this.reload();
  }

  onStatusFilter(value: TaskStatusName | null): void {
    this.statusFilter.set(value ?? null);
    this.pageIndex.set(1);
    this.reload();
  }

  onPriorityFilter(value: ProjectPriorityName | null): void {
    this.priorityFilter.set(value ?? null);
    this.pageIndex.set(1);
    this.reload();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.searchSignal.set('');
    this.projectFilter.set(null);
    this.statusFilter.set(null);
    this.priorityFilter.set(null);
    this.pageIndex.set(1);
    this.reload();
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
  }

  // ─────────── add / edit (admin) ───────────

  openAdd(): void {
    this.editing.set(null);
    this.dialogMode.set('create');
  }

  openEdit(row: TaskListItem): void {
    this.editing.set(row);
    this.dialogMode.set('edit');
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.editing.set(null);
  }

  onSaved(): void {
    this.closeDialog();
    this.reload();
  }

  // ─────────── view ───────────

  openDetails(row: TaskListItem): void {
    this.viewingId.set(row.id);
  }

  closeDetails(): void {
    this.viewingId.set(null);
  }

  // ─────────── developer status update ───────────

  openStatusEdit(row: TaskListItem): void {
    this.statusEditing.set(row);
  }

  closeStatusEdit(): void {
    this.statusEditing.set(null);
  }

  onStatusSaved(): void {
    this.closeStatusEdit();
    this.reload();
  }

  // ─────────── delete (admin) ───────────

  async confirmDelete(row: TaskListItem): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('projects.tasksManage.deleteDialog.title'),
      message: this.t('projects.tasksManage.deleteDialog.message'),
      confirmText: this.t('projects.tasksManage.deleteDialog.confirm'),
      cancelText: this.t('projects.tasksManage.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.tasks.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('projects.tasksManage.messages.deleted'));
        if (this.rows().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── helpers ───────────

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  parseTags(tags: string | null | undefined): string[] {
    if (!tags?.trim()) return [];
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  }

  isOverdue(row: TaskListItem): boolean {
    if (row.status === 'Completed') return false;
    const due = new Date(row.dueDate);
    return !Number.isNaN(due.getTime()) && due < new Date();
  }

  hoursProgress(row: TaskListItem): number {
    if (!row.estimatedHours) return 0;
    return Math.min(100, Math.round(((row.actualHours ?? 0) / row.estimatedHours) * 100));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
