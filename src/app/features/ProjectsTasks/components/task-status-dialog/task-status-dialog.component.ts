import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  TASK_STATUSES,
  TaskListItem,
  TaskStatusName,
  UpdateMyTaskStatusRequest,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TasksService } from '../../services/tasks.service';

/**
 * Developer-only dialog for `UpdateMyTaskStatus` — a developer can move their
 * task along and log the hours actually spent; nothing else.
 */
@Component({
  selector: 'app-task-status-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-status-dialog.component.html',
})
export class TaskStatusDialogComponent implements OnInit {
  @Input({ required: true }) task!: TaskListItem;

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly tasks = inject(TasksService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);

  readonly statuses = TASK_STATUSES;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    status: ['ToDo' as TaskStatusName, Validators.required],
    actualHours: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  ngOnInit(): void {
    // Seed from the caller's own assignee row — the task-level `status`/`actualHours`
    // are the aggregate across every assignee, not this developer's own progress.
    const myUserId = this.auth.currentUser()?.userId;
    const mine = this.task.assignees.find((a) => a.userId === myUserId);
    this.form.reset({
      status: mine?.status ?? this.task.status,
      actualHours: mine?.actualHours ?? this.task.actualHours,
    });
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: UpdateMyTaskStatusRequest = {
      status: v.status,
      actualHours: Number(v.actualHours) || 0,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.tasks.updateMyStatus(this.task.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('projects.tasksManage.messages.statusUpdated'));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
