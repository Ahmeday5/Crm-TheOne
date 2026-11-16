import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ProjectBuildsGateway } from '../../data/project-builds-gateway';
import { AllocationDraft, totalAllocation } from '../../models/project-allocation.models';

/**
 * The project's team + each developer's allocation share, edited in place.
 *
 * The admin adds developers (from the engineers directory), gives each a share
 * and a role, and sees their task progress — all here, one place. A save is
 * blocked while the shares sum over 100%.
 */
@Component({
  selector: 'app-team-allocation',
  standalone: true,
  imports: [FormsModule, TranslatePipe, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-allocation.component.html',
  styleUrl: './team-allocation.component.scss',
})
export class TeamAllocationComponent {
  private readonly gateway = inject(ProjectBuildsGateway);
  private readonly projectsApi = inject(ProjectsService);

  readonly projectId = input.required<number>();
  readonly canEdit = input(true);

  /** Live allocation from the gateway. */
  private readonly saved = toSignal(
    toObservable(this.projectId).pipe(switchMap((id) => this.gateway.developers$(id))),
    { initialValue: [] },
  );

  /** Editable working copy; null until the user enters edit mode. */
  protected readonly draft = signal<AllocationDraft[] | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly adding = signal(false);

  /** Directory of all developers (for the add picker). */
  private readonly allDevs = toSignal(this.projectsApi.developers(), { initialValue: [] });

  protected readonly rows = computed(() => this.draft() ?? this.saved().map((d) => ({
    developerId: d.developerId,
    developerName: d.developerName,
    developerImageUrl: d.developerImageUrl,
    allocationPercent: d.allocationPercent,
    roleOnProject: d.roleOnProject ?? '',
  })));

  protected readonly total = computed(() => totalAllocation(this.rows()));
  protected readonly overBudget = computed(() => this.total() > 100);
  protected readonly isEditing = computed(() => this.draft() !== null);

  /** Developers not yet on the team, for the add dropdown. */
  protected readonly available = computed(() => {
    const picked = new Set(this.rows().map((r) => r.developerId));
    return this.allDevs().filter((d) => !picked.has(d.userId));
  });

  /** Task progress by developer id (for the saved view). */
  protected readonly progressById = computed(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const d of this.saved()) map.set(d.developerId, { done: d.tasksDone, total: d.tasksTotal });
    return map;
  });

  protected startEdit(): void {
    this.draft.set([...this.rows()]);
    this.error.set(null);
  }

  protected cancel(): void {
    this.draft.set(null);
    this.adding.set(false);
    this.error.set(null);
  }

  protected setPercent(id: string, value: number): void {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    this.draft.update((rows) => (rows ?? []).map((r) => (r.developerId === id ? { ...r, allocationPercent: v } : r)));
  }

  protected setRole(id: string, role: string): void {
    this.draft.update((rows) => (rows ?? []).map((r) => (r.developerId === id ? { ...r, roleOnProject: role } : r)));
  }

  protected remove(id: string): void {
    this.draft.update((rows) => (rows ?? []).filter((r) => r.developerId !== id));
  }

  protected addDeveloper(userId: string): void {
    const dev = this.allDevs().find((d) => d.userId === userId);
    if (!dev) return;
    this.draft.update((rows) => [
      ...(rows ?? []),
      { developerId: dev.userId, developerName: dev.fullName, developerImageUrl: null, allocationPercent: 0, roleOnProject: dev.specialty ?? '' },
    ]);
    this.adding.set(false);
  }

  /** Split 100% evenly across the current rows. */
  protected distributeEvenly(): void {
    const rows = this.rows();
    if (!rows.length) return;
    const base = Math.floor(100 / rows.length);
    let remainder = 100 - base * rows.length;
    this.draft.set(rows.map((r) => ({ ...r, allocationPercent: base + (remainder-- > 0 ? 1 : 0) })));
  }

  protected save(): void {
    const rows = this.draft();
    if (!rows || this.overBudget()) return;
    this.saving.set(true);
    this.error.set(null);
    this.gateway.saveDevelopers(this.projectId(), rows).subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.error.set(e?.message ?? 'تعذّر الحفظ');
      },
    });
  }
}
