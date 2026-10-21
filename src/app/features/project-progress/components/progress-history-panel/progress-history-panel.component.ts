import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { SlidePanelComponent } from '../../../../shared/components/slide-panel/slide-panel.component';
import { ProjectProgressHistoryDto } from '../../../../shared/models';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../services/project-progress.service';

@Component({
  selector: 'app-progress-history-panel',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ClampTextDirective,
    SlidePanelComponent,
    LoadErrorComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-history-panel.component.html',
})
export class ProgressHistoryPanelComponent implements OnChanges {
  @Input({ required: true }) projectId!: number;
  /** Scope the history to a single developer, or omit for the whole project. */
  @Input() developerId?: string;

  @Output() cancel = new EventEmitter<void>();

  private readonly service = inject(ProjectProgressService);
  protected readonly language = inject(LanguageService);

  readonly rows = signal<ProjectProgressHistoryDto[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if ('projectId' in changes || 'developerId' in changes) {
      this.reload();
    }
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getHistory(this.projectId, this.developerId).subscribe({
      next: (rows) => {
        this.rows.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(null);
      },
    });
  }

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
