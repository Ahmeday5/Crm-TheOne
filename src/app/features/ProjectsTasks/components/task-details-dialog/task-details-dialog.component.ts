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
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  TaskDetail,
  projectPriorityBadgeClass,
  taskCategoryBadgeClass,
  taskStatusBadgeClass,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TasksService } from '../../services/tasks.service';

@Component({
  selector: 'app-task-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-details-dialog.component.html',
})
export class TaskDetailsDialogComponent implements OnInit {
  @Input({ required: true }) taskId!: number;
  /** When true, read through the developer-scoped endpoint. */
  @Input() developerScope = false;

  @Output() cancel = new EventEmitter<void>();

  private readonly tasks = inject(TasksService);
  protected readonly language = inject(LanguageService);

  readonly details = signal<TaskDetail | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly statusBadge = taskStatusBadgeClass;
  readonly priorityBadge = projectPriorityBadgeClass;
  readonly categoryBadge = taskCategoryBadgeClass;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const request$ = this.developerScope
      ? this.tasks.myGetById(this.taskId)
      : this.tasks.getById(this.taskId);

    request$.subscribe({
      next: (d) => {
        this.details.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(null);
      },
    });
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }
}
