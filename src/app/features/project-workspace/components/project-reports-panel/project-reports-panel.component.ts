import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ProjectDailyReportListDto } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../../project-progress/services/project-progress.service';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';

const DEFAULT_PAGE_SIZE = 10;

/**
 * "التقارير اليومية" (admin): the team's daily reports for this project —
 * filter by date range / developer, open one to read it in full.
 */
@Component({
  selector: 'app-project-reports-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, CairoDatePipe, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-reports-panel.component.html',
  styleUrl: './project-reports-panel.component.scss',
})
export class ProjectReportsPanelComponent {
  private readonly api = inject(ProjectProgressService);
  private readonly workspace = inject(ProjectWorkspaceService);

  readonly projectId = input.required<number>();

  protected readonly rows = signal<ProjectDailyReportListDto[]>([]);
  protected readonly count = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly developerId = signal('');
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  /** Only the project's own developers in the filter. */
  protected readonly developers = signal<{ id: string; name: string }[]>([]);

  ngOnInit(): void {
    this.load();
    this.workspace
      .developers(this.projectId())
      .pipe(catchError(() => of([])))
      .subscribe((list) => this.developers.set(list.map((d) => ({ id: d.developerId, name: d.developerName ?? '—' }))));
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api
      .getProjectReports(this.projectId(), {
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        from: this.from() || undefined,
        to: this.to() || undefined,
        developerId: this.developerId() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  protected setFilter(patch: { from?: string; to?: string; developerId?: string }): void {
    if (patch.from !== undefined) this.from.set(patch.from);
    if (patch.to !== undefined) this.to.set(patch.to);
    if (patch.developerId !== undefined) this.developerId.set(patch.developerId);
    this.pageIndex.set(1);
    this.load();
  }

  protected clearFilters(): void {
    this.setFilter({ from: '', to: '', developerId: '' });
  }

  protected onPage(page: number): void {
    this.pageIndex.set(page);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.load();
  }
}
