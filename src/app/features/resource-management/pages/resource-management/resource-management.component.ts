import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  ExportColumn,
  TableExportService,
} from '../../../../core/services/table-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import {
  DeveloperWorkload,
  PROJECT_PRIORITY_OPTIONS,
  ProjectPriorityName,
  TeamWorkload,
  TeamWorkloadQuery,
  WORKLOAD_SORTS,
  WorkloadDistributionItem,
  WorkloadSort,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ResourceManagementService } from '../../services/resource-management.service';

interface ProjectOption {
  id: number;
  title: string;
}

@Component({
  selector: 'app-resource-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-management.component.html',
  styleUrl: './resource-management.component.scss',
})
export class ResourceManagementComponent implements OnInit, OnDestroy {
  private readonly service = inject(ResourceManagementService);
  private readonly projects = inject(ProjectsService);
  private readonly exporter = inject(TableExportService);
  private readonly toast = inject(ToastService);
  protected readonly language = inject(LanguageService);

  // ── server data ──
  readonly workload = signal<TeamWorkload | null>(null);
  readonly distribution = signal<WorkloadDistributionItem[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── filters ──
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly searchSignal = signal('');
  readonly projectFilter = signal<number | null>(null);
  readonly priorityFilter = signal<ProjectPriorityName | null>(null);
  readonly sort = signal<WorkloadSort>('WorkloadDesc');

  readonly projectOptions = signal<ProjectOption[]>([]);

  /** Which team-overview row is expanded (`null` ⇒ none). */
  readonly expandedId = signal<string | null>(null);

  readonly priorities = PROJECT_PRIORITY_OPTIONS;
  readonly sorts = WORKLOAD_SORTS;

  readonly developers = computed(() => this.workload()?.developers ?? []);

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.reloadWorkload();
      });

    this.loadProjectOptions();
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data ───────────

  private buildQuery(): TeamWorkloadQuery {
    return {
      Search: this.searchSignal().trim() || undefined,
      ProjectId: this.projectFilter() ?? undefined,
      Priority: this.priorityFilter() ?? undefined,
      Sort: this.sort(),
    };
  }

  /** Full (re)load — both feeds. Wired to the empty-state / error retry. */
  reload(): void {
    this.reloadWorkload();
    this.loadDistribution();
  }

  reloadWorkload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.teamWorkload(this.buildQuery()).subscribe({
      next: (data) => {
        this.workload.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('resources.messages.loadFailed'));
      },
    });
  }

  private loadDistribution(): void {
    this.service.workloadDistribution().subscribe({
      next: (rows) => this.distribution.set(rows ?? []),
      error: () => this.distribution.set([]),
    });
  }

  private loadProjectOptions(): void {
    this.projects.list({ PageIndex: 1, PageSize: 1000 }).subscribe({
      next: (page) =>
        this.projectOptions.set(
          (page.data ?? []).map((p) => ({ id: p.id, title: p.title })),
        ),
      error: () => this.projectOptions.set([]),
    });
  }

  // ─────────── filters ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onProjectFilter(value: number | null): void {
    this.projectFilter.set(value ?? null);
    this.reloadWorkload();
  }

  onPriorityFilter(value: ProjectPriorityName | null): void {
    this.priorityFilter.set(value ?? null);
    this.reloadWorkload();
  }

  onSort(value: WorkloadSort): void {
    this.sort.set(value);
    this.reloadWorkload();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.searchSignal.set('');
    this.projectFilter.set(null);
    this.priorityFilter.set(null);
    this.sort.set('WorkloadDesc');
    this.reloadWorkload();
  }

  // ─────────── team overview ───────────

  toggleExpand(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }

  // ─────────── visuals ───────────

  /** Two-letter avatar initials from a full name. */
  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return (parts[0][0] ?? '') + (parts[1][0] ?? '');
  }

  /** Text colour matching the workload band (red→green). */
  workloadColor(pct: number): string {
    if (pct >= 90) return '#dc2626';
    if (pct >= 75) return '#ea580c';
    if (pct >= 55) return '#ca8a04';
    return '#16a34a';
  }

  /** Soft tint used as the distribution-bar fill. */
  workloadTint(pct: number): string {
    if (pct >= 90) return '#fee2e2';
    if (pct >= 75) return '#ffedd5';
    if (pct >= 55) return '#fef9c3';
    return '#dcfce7';
  }

  // ─────────── export ───────────

  exportReport(): void {
    const rows = this.developers();
    if (rows.length === 0) {
      this.toast.warning(this.t('resources.messages.nothingToExport'));
      return;
    }
    const columns: ExportColumn<DeveloperWorkload>[] = [
      { header: this.t('resources.table.developer'), value: (r) => r.fullName },
      { header: this.t('resources.table.specialty'), value: (r) => r.specialty ?? '' },
      { header: this.t('resources.table.tasks'), value: (r) => r.tasksCount },
      { header: this.t('resources.table.usedHours'), value: (r) => r.usedHours },
      { header: this.t('resources.table.availableHours'), value: (r) => r.availableHours },
      { header: this.t('resources.table.capacity'), value: (r) => r.capacityHours },
      { header: this.t('resources.table.workload'), value: (r) => `${r.workloadPercent}%` },
    ];
    void this.exporter
      .toExcel({
        fileName: this.t('resources.title'),
        sheetName: this.t('resources.team.title'),
        columns,
        rows,
      })
      .catch(() => this.toast.error(this.t('common.loadFailed')));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
