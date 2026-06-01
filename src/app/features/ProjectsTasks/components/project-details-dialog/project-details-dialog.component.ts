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
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  ProjectDetail,
  projectPriorityBadgeClass,
  projectStatusBadgeClass,
} from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-project-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    MoneyPipe,
    ModalComponent,
    LoadErrorComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-details-dialog.component.html',
})
export class ProjectDetailsDialogComponent implements OnInit {
  @Input({ required: true }) projectId!: number;
  /** When true, read through the developer-scoped endpoint instead of the admin one. */
  @Input() developerScope = false;

  @Output() cancel = new EventEmitter<void>();

  private readonly service = inject(ProjectsService);
  protected readonly language = inject(LanguageService);

  readonly details = signal<ProjectDetail | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly statusBadge = projectStatusBadgeClass;
  readonly priorityBadge = projectPriorityBadgeClass;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const request$ = this.developerScope
      ? this.service.myGetById(this.projectId)
      : this.service.getById(this.projectId);

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

  formatNumber(value: number | null | undefined): string {
    return (value ?? 0).toLocaleString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
    );
  }
}
