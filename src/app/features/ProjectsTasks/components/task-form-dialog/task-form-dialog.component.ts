import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../../shared/components/multi-select/multi-select.component';
import {
  SearchableSelectComponent,
  SelectFetchParams,
  SelectPageResult,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  CreateTaskRequest,
  FormMode,
  PROJECT_PRIORITY_OPTIONS,
  ProjectPriorityName,
  TASK_CATEGORIES,
  TASK_STATUSES,
  TaskCategoryName,
  TaskListItem,
  TaskStatusName,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../services/projects.service';
import { TasksService } from '../../services/tasks.service';

function nonEmptyArray(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown[];
  return Array.isArray(value) && value.length > 0 ? null : { required: true };
}

@Component({
  selector: 'app-task-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
    MultiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-form-dialog.component.html',
})
export class TaskFormDialogComponent implements OnInit, OnChanges {
  @Input({ required: true }) mode!: FormMode;
  @Input() task: TaskListItem | null = null;
  /** Pre-selected project (when adding from a project-scoped context). */
  @Input() defaultProjectId: number | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly tasks = inject(TasksService);
  private readonly projects = inject(ProjectsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly statuses = TASK_STATUSES;
  readonly priorities = PROJECT_PRIORITY_OPTIONS;
  readonly categories = TASK_CATEGORIES;

  readonly projectsFetchFn = (params: SelectFetchParams): Observable<SelectPageResult> =>
    this.projects.list({ Search: params.search, PageIndex: params.pageIndex, PageSize: params.pageSize })
      .pipe(map((result) => ({ count: result.count, data: result.data as unknown as Record<string, unknown>[] })));

  readonly developerOptions = signal<MultiSelectOption<string>[]>([]);
  readonly loadingDevelopers = signal(false);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    projectId: this.fb.control<number | null>(null, Validators.required),
    assignedToIds: this.fb.nonNullable.control<string[]>([], nonEmptyArray),
    status: ['ToDo' as TaskStatusName, Validators.required],
    priority: ['Medium' as ProjectPriorityName, Validators.required],
    category: ['Development' as TaskCategoryName, Validators.required],
    dueDate: ['', Validators.required],
    estimatedHours: this.fb.control<number | null>(null, [Validators.min(0)]),
    tags: [''],
  });

  readonly titleKey = computed(() =>
    this.mode === 'edit'
      ? 'projects.tasksManage.form.editTitle'
      : 'projects.tasksManage.form.addTitle',
  );

  ngOnInit(): void {
    this.loadDevelopers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'task' in changes || 'defaultProjectId' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.patchFromTask();
    }
  }

  private loadDevelopers(): void {
    this.loadingDevelopers.set(true);
    this.projects.developers().subscribe({
      next: (rows) => {
        this.developerOptions.set(
          (rows ?? []).map((d) => ({ id: d.userId, name: d.fullName })),
        );
        this.loadingDevelopers.set(false);
      },
      error: () => this.loadingDevelopers.set(false),
    });
  }

  private patchFromTask(): void {
    const t = this.task;
    this.form.reset({
      title: t?.title ?? '',
      description: t?.description ?? '',
      projectId: t?.projectId ?? this.defaultProjectId ?? null,
      assignedToIds: t?.assignees?.map((a) => a.userId) ?? [],
      status: t?.status ?? 'ToDo',
      priority: t?.priority ?? 'Medium',
      category: t?.category ?? 'Development',
      dueDate: this.toDateInput(t?.dueDate),
      estimatedHours: t?.estimatedHours ?? null,
      tags: t?.tags ?? '',
    });
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: CreateTaskRequest = {
      title: v.title.trim(),
      description: (v.description ?? '').trim(),
      projectId: Number(v.projectId),
      assignedToIds: v.assignedToIds,
      status: v.status,
      priority: v.priority,
      category: v.category,
      dueDate: this.toIso(v.dueDate),
      estimatedHours: Number(v.estimatedHours) || 0,
      tags: (v.tags ?? '').trim(),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ =
      this.mode === 'edit' && this.task
        ? this.tasks.update(this.task.id, payload)
        : this.tasks.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          this.t(
            this.mode === 'edit'
              ? 'projects.tasksManage.messages.updated'
              : 'projects.tasksManage.messages.created',
          ),
        );
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private toDateInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  private toIso(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00`).toISOString();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
