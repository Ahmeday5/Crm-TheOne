import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MILESTONE_STATUSES, Milestone, MilestoneInput, MilestoneStatus } from '../../models/workspace.models';
import { MilestonesService } from '../../data/milestones.gateway';
import { WorkspaceScope } from '../../models/deliverables.models';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

interface Draft {
  id: number | null;
  title: string;
  description: string;
  status: MilestoneStatus;
  /** `yyyy-MM-dd` for the date input. */
  dueDate: string;
}

/**
 * The plan the client sees: an ordered checklist. Drag (or ↑↓) to reorder,
 * one-click "تم ✓" (optimistic), add / edit in a small dialog. Admin and the
 * project's developers edit it the same way; only the Admin deletes.
 * Marking a milestone done also posts a client-visible timeline event.
 */
@Component({
  selector: 'app-milestones-panel',
  standalone: true,
  imports: [FormsModule, TranslatePipe, CairoDatePipe, TimeAgoPipe, ModalComponent, MockRibbonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './milestones-panel.component.html',
  styleUrl: './milestones-panel.component.scss',
})
export class MilestonesPanelComponent {
  private readonly milestones = inject(MilestonesService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly projectId = input.required<number>();
  /** `admin` → ManagerProjects, `developer` → DeveloperProjects (no delete). */
  readonly scope = input<WorkspaceScope>('admin');
  protected readonly canDelete = computed(() => this.scope() === 'admin');
  private readonly api = computed(() => this.milestones.for(this.scope()));

  protected readonly statuses = MILESTONE_STATUSES;
  protected readonly items = signal<Milestone[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly reordering = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);
  protected readonly dragId = signal<number | null>(null);
  protected readonly overId = signal<number | null>(null);

  protected readonly doneCount = computed(() => this.items().filter((m) => m.status === 'Done').length);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api().list(this.projectId()).subscribe({
      next: (list) => {
        this.items.set(sortByOrder(list));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  // ─────────── create / edit ───────────

  protected openNew(): void {
    this.error.set(null);
    this.draft.set({ id: null, title: '', description: '', status: 'Pending', dueDate: '' });
  }

  protected openEdit(m: Milestone): void {
    this.error.set(null);
    this.draft.set({
      id: m.id,
      title: m.title,
      description: m.description ?? '',
      status: m.status,
      dueDate: m.dueDate ? m.dueDate.slice(0, 10) : '',
    });
  }

  protected patchDraft(patch: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...patch } : d));
  }

  protected saveDraft(): void {
    const d = this.draft();
    if (!d || !d.title.trim() || this.saving()) return;
    const existing = d.id !== null ? this.items().find((m) => m.id === d.id) : null;
    const body: MilestoneInput = {
      title: d.title.trim(),
      description: d.description.trim() || null,
      status: d.status,
      dueDate: d.dueDate ? `${d.dueDate}T00:00:00Z` : null,
      ...(existing ? { orderIndex: existing.orderIndex } : {}),
    };
    this.saving.set(true);
    const call$ = d.id === null
      ? this.api().create(this.projectId(), body)
      : this.api().update(this.projectId(), d.id, body);
    call$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.draft.set(null);
        this.upsert(saved);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.error.set(e?.message ?? null);
      },
    });
  }

  // ─────────── quick actions ───────────

  protected markDone(m: Milestone): void {
    this.setStatus(m, 'Done');
  }

  /** Optimistic: the new status shows at once, rolled back if the save fails. */
  protected setStatus(m: Milestone, status: MilestoneStatus): void {
    if (m.status === status) return;
    const previous = m;
    this.upsert({ ...m, status, completedAt: status === 'Done' ? new Date().toISOString() : null });
    this.busyId.set(m.id);
    this.error.set(null);
    this.api().setStatus(this.projectId(), m.id, status).subscribe({
      next: (saved) => {
        this.busyId.set(null);
        this.upsert(saved);
      },
      error: (e: ApiError) => {
        this.busyId.set(null);
        this.upsert(previous);
        this.error.set(e?.message ?? null);
      },
    });
  }

  protected async remove(m: Milestone): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('milestones.deleteTitle'),
      message: this.t('milestones.deleteMessage').replace('{title}', m.title),
      confirmText: this.t('common.delete'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(m.id);
    this.api().remove(this.projectId(), m.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.items.update((list) => list.filter((x) => x.id !== m.id));
      },
      error: (e: ApiError) => {
        this.busyId.set(null);
        this.error.set(e?.message ?? null);
      },
    });
  }

  // ─────────── reorder ───────────

  protected move(index: number, delta: -1 | 1): void {
    const list = [...this.items()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.commitOrder(list);
  }

  protected onDragStart(id: number, event: DragEvent): void {
    this.dragId.set(id);
    event.dataTransfer?.setData('text/plain', String(id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(id: number, event: DragEvent): void {
    if (this.dragId() === null) return;
    event.preventDefault();
    this.overId.set(id);
  }

  protected onDrop(targetId: number, event: DragEvent): void {
    event.preventDefault();
    const fromId = this.dragId();
    this.dragId.set(null);
    this.overId.set(null);
    if (fromId === null || fromId === targetId) return;
    const list = [...this.items()];
    const from = list.findIndex((m) => m.id === fromId);
    const to = list.findIndex((m) => m.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this.commitOrder(list);
  }

  protected onDragEnd(): void {
    this.dragId.set(null);
    this.overId.set(null);
  }

  /** Optimistic: show the new order, then `PUT …/milestones/order` with all ids. */
  private commitOrder(list: Milestone[]): void {
    const previous = this.items();
    const renumbered = list.map((m, i) => ({ ...m, orderIndex: i }));
    const changed = renumbered.filter((m) => previous.find((p) => p.id === m.id)?.orderIndex !== m.orderIndex);
    this.items.set(renumbered);
    if (!changed.length) return;
    this.reordering.set(true);
    this.error.set(null);
    this.api()
      .reorder(this.projectId(), renumbered.map((m) => m.id))
      .subscribe({
        next: () => this.reordering.set(false),
        error: (e: ApiError) => {
          this.reordering.set(false);
          this.items.set(previous);
          this.error.set(e?.message ?? null);
        },
      });
  }

  private upsert(saved: Milestone): void {
    this.items.update((list) =>
      sortByOrder(list.some((m) => m.id === saved.id) ? list.map((m) => (m.id === saved.id ? saved : m)) : [...list, saved]),
    );
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

function sortByOrder(list: Milestone[]): Milestone[] {
  return [...list].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id);
}
