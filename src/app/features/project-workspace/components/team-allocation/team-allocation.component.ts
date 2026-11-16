import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { RowMenuComponent, RowMenuItem } from '../../../../shared/components/row-menu/row-menu.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ProjectTeamMemberResponseDto } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { AdjustProgressDialogComponent } from '../../../project-progress/components/adjust-progress-dialog/adjust-progress-dialog.component';
import { ProgressHistoryPanelComponent } from '../../../project-progress/components/progress-history-panel/progress-history-panel.component';
import { ProjectProgressService } from '../../../project-progress/services/project-progress.service';
import { PROJECT_ROLE_SUGGESTIONS, totalAllocation } from '../../models/workspace.models';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';

/** One row: the developer's share (editable) + their live progress (read-only). */
interface Row {
  developerId: string;
  name: string;
  imageUrl: string | null;
  allocationPercent: number;
  roleOnProject: string;
  tasksDone: number | null;
  tasksTotal: number | null;
  /** From `ProjectProgress` — how much of the share is done, and today's report. */
  earned: number | null;
  reportedToday: boolean | null;
}

/**
 * "الفريق والتقدّم" — the team, each developer's share of the project and how
 * much of it they've delivered, in one table.
 *
 * Admin: edit role / share inline (+ add / remove), sticky total that blocks
 * Save over 100%, one PUT saves the whole team. Per row: adjust progress and
 * its history. Developer: the same table read-only.
 *
 * (Replaces the old `/ProjectManage/:id/progress` team table and its separate
 * "assign team" dialog — the share IS the responsibility percentage.)
 */
@Component({
  selector: 'app-team-allocation',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    UserAvatarComponent,
    RowMenuComponent,
    AdjustProgressDialogComponent,
    ProgressHistoryPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-allocation.component.html',
  styleUrl: './team-allocation.component.scss',
})
export class TeamAllocationComponent {
  private readonly workspace = inject(ProjectWorkspaceService);
  private readonly progressApi = inject(ProjectProgressService);
  private readonly projectsApi = inject(ProjectsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<number>();
  readonly canEdit = input(false);
  /** Team / progress changed — the page refreshes its summary. */
  readonly changed = output<void>();

  protected readonly roleSuggestions = PROJECT_ROLE_SUGGESTIONS;

  protected readonly rows = signal<Row[]>([]);
  private readonly saved = signal<string>('[]');
  /** Progress per developer (`ProjectProgress/{id}/summary` → teamMembers). */
  private readonly progress = signal<ReadonlyMap<string, ProjectTeamMemberResponseDto>>(new Map());
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savedFlash = signal(false);
  protected readonly picking = signal(false);

  protected readonly adjusting = signal<ProjectTeamMemberResponseDto | null>(null);
  protected readonly historyFor = signal<{ developerId?: string } | null>(null);

  private readonly directory = toSignal(this.projectsApi.developers().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  protected readonly total = computed(() => totalAllocation(this.rows()));
  protected readonly overBudget = computed(() => this.total() > 100);
  protected readonly dirty = computed(() => this.serialize(this.rows()) !== this.saved());
  protected readonly canSave = computed(() => this.dirty() && !this.overBudget() && !this.saving());
  protected readonly available = computed(() => {
    const taken = new Set(this.rows().map((r) => r.developerId));
    return this.directory().filter((d) => !taken.has(d.userId));
  });
  /** Today's reports: x of n developers reported. */
  protected readonly reportedCount = computed(() => this.rows().filter((r) => r.reportedToday).length);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const id = this.projectId();
    if (this.canEdit()) {
      this.loadProgress();
      this.workspace
        .developers(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (list) =>
            this.apply(
              list.map((d) => ({
                developerId: d.developerId,
                name: d.developerName ?? '—',
                imageUrl: d.developerImageUrl,
                allocationPercent: d.allocationPercent,
                roleOnProject: d.roleOnProject ?? '',
                tasksDone: d.tasksDone,
                tasksTotal: d.tasksTotal,
                earned: null,
                reportedToday: null,
              })),
            ),
          error: () => this.fail(),
        });
    } else {
      // Developers: the team endpoint already carries share + progress.
      this.progressApi
        .getTeam(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (list) => {
            this.progress.set(new Map(list.map((m) => [m.developerId, m])));
            this.apply(
              list.map((m) => ({
                developerId: m.developerId,
                name: m.developerName ?? '—',
                imageUrl: null,
                allocationPercent: m.responsibilityPercentage,
                roleOnProject: m.projectRole ?? '',
                tasksDone: null,
                tasksTotal: null,
                earned: m.earnedProgressPercentage,
                reportedToday: m.hasReportedToday,
              })),
            );
          },
          error: () => this.fail(),
        });
    }
  }

  /** Merge live progress into the rows (admin). */
  private loadProgress(): void {
    this.progressApi
      .getSummary(this.projectId(), true)
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        this.progress.set(new Map((s?.teamMembers ?? []).map((m) => [m.developerId, m])));
        this.rows.update((rows) => rows.map((r) => this.withProgress(r)));
      });
  }

  // ─────────── editing (admin) ───────────

  protected setPercent(id: string, value: unknown): void {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    this.patch(id, { allocationPercent: v });
  }

  protected setRole(id: string, value: string): void {
    this.patch(id, { roleOnProject: value });
  }

  protected add(userId: string): void {
    const dev = this.directory().find((d) => d.userId === userId);
    if (!dev) return;
    this.rows.update((rows) => [
      ...rows,
      {
        developerId: dev.userId,
        name: dev.fullName,
        imageUrl: null,
        allocationPercent: Math.max(0, 100 - this.total()),
        roleOnProject: dev.specialty ?? '',
        tasksDone: 0,
        tasksTotal: 0,
        earned: null,
        reportedToday: null,
      },
    ]);
    this.picking.set(false);
  }

  protected distributeEvenly(): void {
    const rows = this.rows();
    if (!rows.length) return;
    const base = Math.floor(100 / rows.length);
    let extra = 100 - base * rows.length;
    this.rows.set(rows.map((r) => ({ ...r, allocationPercent: base + (extra-- > 0 ? 1 : 0) })));
  }

  protected reset(): void {
    this.load();
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    this.workspace
      .saveDevelopers(
        this.projectId(),
        this.rows().map((r) => ({
          developerId: r.developerId,
          allocationPercent: r.allocationPercent,
          roleOnProject: r.roleOnProject.trim() || null,
        })),
      )
      .subscribe({
        next: (list) => {
          this.saving.set(false);
          this.apply(
            list.map((d) => ({
              developerId: d.developerId,
              name: d.developerName ?? '—',
              imageUrl: d.developerImageUrl,
              allocationPercent: d.allocationPercent,
              roleOnProject: d.roleOnProject ?? '',
              tasksDone: d.tasksDone,
              tasksTotal: d.tasksTotal,
              earned: null,
              reportedToday: null,
            })),
          );
          // A lower share clamps earned progress server-side — re-read it.
          this.loadProgress();
          this.changed.emit();
          this.savedFlash.set(true);
          setTimeout(() => this.savedFlash.set(false), 2000);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.error.set(e?.message ?? null);
        },
      });
  }

  // ─────────── per-row actions ───────────

  protected menuFor(r: Row): RowMenuItem[] {
    const items: RowMenuItem[] = [];
    if (this.progress().has(r.developerId)) {
      items.push({ id: 'adjust', labelKey: 'projectTeam.adjust', icon: 'fa-solid fa-sliders' });
    }
    items.push({ id: 'history', labelKey: 'projectTeam.history', icon: 'fa-solid fa-clock-rotate-left' });
    items.push({ id: 'remove', labelKey: 'projectTeam.remove', icon: 'fa-solid fa-user-minus', tone: 'danger' });
    return items;
  }

  protected onRowAction(action: string, r: Row): void {
    switch (action) {
      case 'adjust':
        this.adjusting.set(this.progress().get(r.developerId) ?? null);
        break;
      case 'history':
        this.historyFor.set({ developerId: r.developerId });
        break;
      case 'remove':
        this.rows.update((rows) => rows.filter((x) => x.developerId !== r.developerId));
        break;
    }
  }

  protected onAdjusted(): void {
    this.adjusting.set(null);
    this.loadProgress();
    this.changed.emit();
  }

  /** Share of the developer's allocation already delivered (0–100 of their bar). */
  protected earnedOfShare(r: Row): number {
    return r.earned != null && r.allocationPercent ? Math.min(100, (r.earned / r.allocationPercent) * 100) : 0;
  }

  // ─────────── helpers ───────────

  private withProgress(r: Row): Row {
    const m = this.progress().get(r.developerId);
    return m ? { ...r, earned: m.earnedProgressPercentage, reportedToday: m.hasReportedToday } : r;
  }

  private apply(rows: Row[]): void {
    const merged = rows.map((r) => this.withProgress(r));
    this.rows.set(merged);
    this.saved.set(this.serialize(merged));
    this.loading.set(false);
  }

  private fail(): void {
    this.loading.set(false);
    this.loadFailed.set(true);
  }

  private patch(id: string, patch: Partial<Row>): void {
    this.rows.update((rows) => rows.map((r) => (r.developerId === id ? { ...r, ...patch } : r)));
  }

  private serialize(rows: Row[]): string {
    return JSON.stringify(rows.map((r) => [r.developerId, r.allocationPercent, r.roleOnProject.trim()]));
  }
}
