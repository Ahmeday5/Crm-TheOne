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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  DataTableComponent,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  DeveloperOption,
  ProjectDailyReportListDto,
  ProjectProgressSummaryDto,
  ProjectTeamMemberResponseDto,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { AdjustProgressDialogComponent } from '../../components/adjust-progress-dialog/adjust-progress-dialog.component';
import { AssignTeamDialogComponent } from '../../components/assign-team-dialog/assign-team-dialog.component';
import { ProgressHistoryPanelComponent } from '../../components/progress-history-panel/progress-history-panel.component';
import { ProjectProgressService } from '../../services/project-progress.service';

type AdminTab = 'overview' | 'team' | 'reports';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-project-progress-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    DataTableComponent,
    EmptyStateComponent,
    LoadErrorComponent,
    PaginationComponent,
    StatCardComponent,
    AssignTeamDialogComponent,
    AdjustProgressDialogComponent,
    ProgressHistoryPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-progress-admin.component.html',
})
export class ProjectProgressAdminComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ProjectProgressService);
  private readonly projectsService = inject(ProjectsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));

  readonly activeTab = signal<AdminTab>('overview');

  readonly summary = signal<ProjectProgressSummaryDto | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── team dialogs ──
  readonly showAssignTeam = signal(false);
  readonly adjustingMember = signal<ProjectTeamMemberResponseDto | null>(null);
  readonly historyFor = signal<{ developerId?: string } | null>(null);

  // ── reports tab ──
  readonly reportRows = signal<ProjectDailyReportListDto[]>([]);
  readonly reportCount = signal(0);
  readonly reportPageIndex = signal(1);
  readonly reportPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly reportFrom = signal('');
  readonly reportTo = signal('');
  readonly reportDeveloperId = signal('');
  readonly reportsLoading = signal(false);
  readonly reportsLoadError = signal<string | null>(null);
  readonly developerOptions = signal<DeveloperOption[]>([]);

  private readonly developerCell =
    viewChild<TemplateRef<{ $implicit: ProjectTeamMemberResponseDto }>>('developerCell');
  private readonly responsibilityCell =
    viewChild<TemplateRef<{ $implicit: ProjectTeamMemberResponseDto }>>('responsibilityCell');
  private readonly earnedCell =
    viewChild<TemplateRef<{ $implicit: ProjectTeamMemberResponseDto }>>('earnedCell');
  private readonly todayStatusCell =
    viewChild<TemplateRef<{ $implicit: ProjectTeamMemberResponseDto }>>('todayStatusCell');

  readonly teamColumns = computed<ReadonlyArray<TableColumn<ProjectTeamMemberResponseDto>>>(() => [
    {
      key: 'developerName',
      label: 'projectProgress.admin.table.developer',
      i18nLabel: true,
      cellTemplate: this.developerCell(),
    },
    {
      key: 'responsibilityPercentage',
      label: 'projectProgress.admin.table.responsibility',
      i18nLabel: true,
      cellTemplate: this.responsibilityCell(),
    },
    {
      key: 'earnedProgressPercentage',
      label: 'projectProgress.admin.table.earned',
      i18nLabel: true,
      width: '220px',
      cellTemplate: this.earnedCell(),
    },
    {
      key: 'hasReportedToday',
      label: 'projectProgress.admin.table.todayStatus',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.todayStatusCell(),
    },
  ]);

  private readonly reportDateCell =
    viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('reportDateCell');
  private readonly reportDeveloperCell =
    viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('reportDeveloperCell');
  private readonly reportContributionCell =
    viewChild<TemplateRef<{ $implicit: ProjectDailyReportListDto }>>('reportContributionCell');

  readonly reportColumns = computed<ReadonlyArray<TableColumn<ProjectDailyReportListDto>>>(() => [
    {
      key: 'reportDate',
      label: 'projectProgress.admin.table.date',
      i18nLabel: true,
      cellTemplate: this.reportDateCell(),
    },
    {
      key: 'developerName',
      label: 'projectProgress.admin.table.developer',
      i18nLabel: true,
      cellTemplate: this.reportDeveloperCell(),
    },
    {
      key: 'completedWorkPreview',
      label: 'projectProgress.admin.table.preview',
      i18nLabel: true,
    },
    {
      key: 'appliedProgressContribution',
      label: 'projectProgress.admin.table.contribution',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.reportContributionCell(),
    },
  ]);

  ngOnInit(): void {
    this.reload();
    this.loadDevelopers();
  }

  // ─────────── loading ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getSummary(this.projectId, true).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('projectProgress.messages.loadFailed'));
      },
    });
  }

  private loadDevelopers(): void {
    this.projectsService.developers().subscribe({
      next: (rows) => this.developerOptions.set(rows ?? []),
      error: () => this.developerOptions.set([]),
    });
  }

  selectTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    if (tab === 'reports' && this.reportRows().length === 0) {
      this.loadReports();
    }
  }

  // ─────────── team assignment ───────────

  openAssignTeam(): void {
    this.showAssignTeam.set(true);
  }

  closeAssignTeam(): void {
    this.showAssignTeam.set(false);
  }

  onTeamAssigned(): void {
    this.closeAssignTeam();
    this.reload();
  }

  // ─────────── adjust progress ───────────

  openAdjust(member: ProjectTeamMemberResponseDto): void {
    this.adjustingMember.set(member);
  }

  closeAdjust(): void {
    this.adjustingMember.set(null);
  }

  onAdjusted(): void {
    this.closeAdjust();
    this.reload();
  }

  // ─────────── history panel ───────────

  openHistory(developerId?: string): void {
    this.historyFor.set({ developerId });
  }

  closeHistory(): void {
    this.historyFor.set(null);
  }

  // ─────────── reports tab ───────────

  loadReports(): void {
    this.reportsLoading.set(true);
    this.reportsLoadError.set(null);
    this.service
      .getProjectReports(this.projectId, {
        pageIndex: this.reportPageIndex(),
        pageSize: this.reportPageSize(),
        from: this.reportFrom() || undefined,
        to: this.reportTo() || undefined,
        developerId: this.reportDeveloperId() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.reportRows.set(page.data ?? []);
          this.reportCount.set(page.count ?? 0);
          this.reportsLoading.set(false);
        },
        error: () => {
          this.reportsLoading.set(false);
          this.reportsLoadError.set(this.t('projectProgress.messages.loadFailed'));
        },
      });
  }

  onReportFilterChange(): void {
    this.reportPageIndex.set(1);
    this.loadReports();
  }

  onReportPageChange(page: number): void {
    this.reportPageIndex.set(page);
    this.loadReports();
  }

  onReportPageSizeChange(size: number): void {
    this.reportPageSize.set(size);
    this.reportPageIndex.set(1);
    this.loadReports();
  }

  openReport(row: ProjectDailyReportListDto): void {
    this.router.navigate(['/ProjectManage', 'reports', row.id]);
  }

  // ─────────── helpers ───────────

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
