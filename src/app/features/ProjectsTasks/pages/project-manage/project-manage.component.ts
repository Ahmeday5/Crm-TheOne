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
import { NgApexchartsModule } from 'ng-apexcharts';
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
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableToolsComponent } from '../../../../shared/components/table-tools/table-tools.component';
import {
  FormMode,
  ProjectListItem,
  ProjectListQuery,
  TaskStatistics,
  projectPriorityBadgeClass,
  projectStatusBadgeClass,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectDetailsDialogComponent } from '../../components/project-details-dialog/project-details-dialog.component';
import { ProjectFormDialogComponent } from '../../components/project-form-dialog/project-form-dialog.component';
import { ProjectsService } from '../../services/projects.service';
import { TasksService } from '../../services/tasks.service';

type ProjectsTab = 'all' | 'active';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-project-manage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    DataTableComponent,
    LoadErrorComponent,
    PaginationComponent,
    StatCardComponent,
    TableToolsComponent,
    NgApexchartsModule,
    ProjectFormDialogComponent,
    ProjectDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-manage.component.html',
  styleUrl: './project-manage.component.scss',
})
export class ProjectManageComponent implements OnInit, OnDestroy {
  private readonly service = inject(ProjectsService);
  private readonly tasksService = inject(TasksService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  /** Admins get full CRUD over every project; everyone else is read-only "my projects". */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  /** Board statistics (KPI strip + 2 charts) — admin vs. developer scoped. */
  readonly stats = signal<TaskStatistics | null>(null);

  readonly activeTab = signal<ProjectsTab>('all');

  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly rows = signal<ProjectListItem[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly searchSignal = signal('');

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Form-dialog state — `null` ⇒ closed (admin only). */
  readonly dialogMode = signal<FormMode | null>(null);
  readonly editing = signal<ProjectListItem | null>(null);

  /** Details-dialog state — holds the id being viewed. */
  readonly viewingId = signal<number | null>(null);

  /** Per-row spinner key (delete). */
  readonly busyId = signal<number | null>(null);

  readonly statusBadge = projectStatusBadgeClass;
  readonly priorityBadge = projectPriorityBadgeClass;

  // ── cell templates wired into the column defs ──
  private readonly customerCell =
    viewChild<TemplateRef<{ $implicit: ProjectListItem }>>('customerCell');
  private readonly priorityCell =
    viewChild<TemplateRef<{ $implicit: ProjectListItem }>>('priorityCell');
  private readonly statusCell =
    viewChild<TemplateRef<{ $implicit: ProjectListItem }>>('statusCell');
  private readonly progressCell =
    viewChild<TemplateRef<{ $implicit: ProjectListItem }>>('progressCell');
  private readonly teamCell =
    viewChild<TemplateRef<{ $implicit: ProjectListItem }>>('teamCell');

  readonly columns = computed<ReadonlyArray<TableColumn<ProjectListItem>>>(() => [
    { key: 'title', label: 'projects.manage.table.project', i18nLabel: true },
    {
      key: 'customerName',
      label: 'projects.manage.table.customer',
      i18nLabel: true,
      cellTemplate: this.customerCell(),
    },
    {
      key: 'priority',
      label: 'projects.manage.table.priority',
      i18nLabel: true,
      cellTemplate: this.priorityCell(),
    },
    {
      key: 'status',
      label: 'projects.manage.table.status',
      i18nLabel: true,
      cellTemplate: this.statusCell(),
    },
    {
      key: 'progress',
      label: 'projects.manage.table.progress',
      i18nLabel: true,
      width: '180px',
      cellTemplate: this.progressCell(),
    },
    {
      key: 'teamMembersCount',
      label: 'projects.manage.table.team',
      i18nLabel: true,
      align: 'center',
      cellTemplate: this.teamCell(),
    },
  ]);

  // ── ApexCharts options (rebuilt whenever stats or language change) ──
  readonly weeklyChart = computed<Record<string, unknown>>(() => {
    const wp = this.stats()?.weeklyProductivity ?? [];
    return {
      series: [
        {
          name: this.t('projects.manage.board.completedTasks'),
          data: wp.map((p) => p.completedTasks),
        },
      ],
      chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: wp.map((p) => p.day) },
      colors: ['#8b5cf6'],
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  readonly progressChart = computed<Record<string, unknown>>(() => {
    const pp = this.stats()?.projectsProgress ?? [];
    return {
      series: [
        {
          name: this.t('projects.manage.board.completed'),
          data: pp.map((p) => p.completed),
        },
        {
          name: this.t('projects.manage.board.inProgress'),
          data: pp.map((p) => p.inProgress),
        },
      ],
      chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: pp.map((p) => p.week) },
      colors: ['#10b981', '#3b82f6'],
      legend: { position: 'bottom' },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    };
  });

  readonly kpis = computed(() => ({
    total: this.count(),
    visible: this.rows().length,
    page: this.pageIndex(),
    pageSize: this.pageSize(),
  }));

  // ─────────── export / print ───────────

  get exportColumns(): ExportColumn<ProjectListItem>[] {
    return [
      { header: this.t('projects.manage.table.project'), value: (r) => r.title },
      { header: this.t('projects.manage.table.customer'), value: (r) => r.customerName },
      { header: this.t('projects.manage.details.company'), value: (r) => r.companyName ?? '' },
      {
        header: this.t('projects.manage.table.priority'),
        value: (r) => this.t('projects.manage.priorities.' + r.priority),
      },
      {
        header: this.t('projects.manage.table.status'),
        value: (r) => this.t('projects.manage.statuses.' + r.status),
      },
      { header: this.t('projects.manage.table.progress'), value: (r) => `${r.progress}%` },
      { header: this.t('projects.manage.table.price'), value: (r) => r.price },
      { header: this.t('projects.manage.table.team'), value: (r) => r.teamMembersCount },
    ];
  }

  readonly fetchAllRows = async (): Promise<ProjectListItem[]> => {
    const page = await firstValueFrom(
      this.fetch({
        PageIndex: 1,
        PageSize: this.count() || this.pageSize(),
        Search: this.searchSignal().trim() || undefined,
      }),
    );
    return page.data ?? [];
  };

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });
    this.reload();
    this.loadStats();
  }

  private loadStats(): void {
    const stats$ = this.isAdmin()
      ? this.tasksService.statistics()
      : this.tasksService.myStatistics();
    stats$.subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  /** Picks the right endpoint for the current role + tab. */
  private fetch(query: ProjectListQuery, force = false) {
    if (this.isAdmin()) {
      return this.activeTab() === 'active'
        ? this.service.activeList(query, force)
        : this.service.list(query, force);
    }
    return this.activeTab() === 'active'
      ? this.service.myActiveList(query, force)
      : this.service.myList(query, force);
  }

  reload(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.fetch(
      {
        PageIndex: this.pageIndex(),
        PageSize: this.pageSize(),
        Search: this.searchSignal().trim() || undefined,
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
        this.loadError.set(this.t('projects.manage.messages.loadFailed'));
      },
    });
  }

  // ─────────── tabs / search / pagination ───────────

  selectTab(tab: ProjectsTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.pageIndex.set(1);
    this.reload();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
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

  openEdit(row: ProjectListItem): void {
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

  // ─────────── view details ───────────

  openDetails(row: ProjectListItem): void {
    this.viewingId.set(row.id);
  }

  closeDetails(): void {
    this.viewingId.set(null);
  }

  // ─────────── delete (admin) ───────────

  async confirmDelete(row: ProjectListItem): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('projects.manage.deleteDialog.title'),
      message: this.t('projects.manage.deleteDialog.message'),
      confirmText: this.t('projects.manage.deleteDialog.confirm'),
      cancelText: this.t('projects.manage.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.service.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('projects.manage.messages.deleted'));
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

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
