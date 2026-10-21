import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  DataTableComponent,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ProjectDailyReportListDto } from '../../../../shared/models';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../services/project-progress.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-my-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ClampTextDirective,
    DataTableComponent,
    EmptyStateComponent,
    LoadErrorComponent,
    PaginationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-reports.component.html',
  // Keeps the free-text preview column from dominating the desktop table.
  styles: [`.preview-cell { max-width: 420px; }`],
})
export class MyReportsComponent implements OnInit {
  private readonly service = inject(ProjectProgressService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  readonly rows = signal<ProjectDailyReportListDto[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly from = signal('');
  readonly to = signal('');

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  private readonly dateCell = viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('dateCell');
  private readonly projectCell = viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('projectCell');
  private readonly previewCell = viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('previewCell');
  private readonly contributionCell =
    viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('contributionCell');

  readonly columns = computed<ReadonlyArray<TableColumn<ProjectDailyReportListDto>>>(() => [
    {
      key: 'reportDate',
      label: 'projectProgress.admin.table.date',
      i18nLabel: true,
      cellTemplate: this.dateCell(),
    },
    {
      key: 'projectTitle',
      label: 'projectProgress.admin.table.project',
      i18nLabel: true,
      cellTemplate: this.projectCell(),
    },
    {
      key: 'completedWorkPreview',
      label: 'projectProgress.admin.table.preview',
      i18nLabel: true,
      cellTemplate: this.previewCell(),
    },
    {
      key: 'appliedProgressContribution',
      label: 'projectProgress.admin.table.contribution',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.contributionCell(),
    },
  ]);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service
      .getMyReports({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        from: this.from() || undefined,
        to: this.to() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('projectProgress.messages.loadFailed'));
        },
      });
  }

  onFilterChange(): void {
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

  openReport(row: ProjectDailyReportListDto): void {
    this.router.navigate(['/ProjectManage', 'reports', row.id]);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
