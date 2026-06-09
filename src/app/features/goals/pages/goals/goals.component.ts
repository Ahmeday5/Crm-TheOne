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
import { Subject, debounceTime, distinctUntilChanged, takeUntil, timer } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  Goal,
  GoalListQuery,
  GoalPeriod,
  GoalStats,
  GoalType,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GoalFormDialogComponent } from '../../components/goal-form-dialog/goal-form-dialog.component';
import { GoalsService } from '../../services/goals.service';

type GoalStatus = 'active' | 'upcoming' | 'expired';
type FilterStatus = 'all' | GoalStatus;
type FilterType = 'all' | GoalType;
type FilterPeriod = 'all' | GoalPeriod;
type FilterAchieved = 'all' | 'achieved' | 'inProgress';

interface LeaderboardEntry {
  name: string;
  initials: string;
  totalPoints: number;
  totalReward: number;
  goalCount: number;
}

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
    GoalFormDialogComponent,
    ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss',
})
export class GoalsComponent implements OnInit, OnDestroy {
  private readonly goalsService = inject(GoalsService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  // ── list state ──
  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── stats ──
  readonly stats = signal<GoalStats | null>(null);
  readonly statsLoading = signal(false);
  readonly breakdownExpanded = signal(false);

  // ── server-side filters (trigger API reload) ──
  readonly search = signal('');
  readonly filterType = signal<FilterType>('all');
  readonly filterPeriod = signal<FilterPeriod>('all');
  readonly filterAchieved = signal<FilterAchieved>('all');

  // ── client-side filter (date-based status) ──
  readonly filterStatus = signal<FilterStatus>('all');

  // ── form / delete dialogs ──
  readonly formDialog = signal<Goal | 'new' | null>(null);
  readonly deleteDialog = signal<Goal | null>(null);
  readonly deleting = signal(false);

  // ── progress update ──
  readonly progressGoal = signal<Goal | null>(null);
  readonly progressInput = signal(0);
  readonly progressUpdating = signal(false);

  // ── celebration ──
  readonly celebratingTitle = signal<string | null>(null);

  // ── goal detail (uses /Goals/{id}/stats) ──
  readonly goalDetailDialog = signal<Goal | null>(null);
  readonly goalDetailLoading = signal(false);

  // ── computed ──
  readonly editGoal = computed<Goal | null>(() => {
    const d = this.formDialog();
    return d === null || d === 'new' ? null : d;
  });

  readonly leaderboard = computed((): LeaderboardEntry[] => {
    const s = this.stats();
    if (!s || s.pointsBreakdown.length === 0) return [];
    const map = new Map<string, LeaderboardEntry>();
    for (const row of s.pointsBreakdown) {
      const key = row.userName || '—';
      const e = map.get(key);
      if (e) {
        e.totalPoints += row.pointsEarned;
        e.totalReward += row.rewardEarned;
        e.goalCount++;
      } else {
        map.set(key, {
          name: key,
          initials: key.split(' ').map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join(''),
          totalPoints: row.pointsEarned,
          totalReward: row.rewardEarned,
          goalCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  });

  readonly filteredGoals = computed(() => {
    const status = this.filterStatus();
    if (status === 'all') return this.goals();
    return this.goals().filter(g => this.goalStatus(g) === status);
  });

  ngOnInit(): void {
    // Debounce search → server reload
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.load());

    this.loadStats();
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data ───────────

  load(force = false): void {
    this.loading.set(true);
    this.loadError.set(null);

    const query: GoalListQuery = {};
    const s = this.search().trim();
    if (s) query.Search = s;
    const t = this.filterType();
    if (t !== 'all') query.Type = t;
    const p = this.filterPeriod();
    if (p !== 'all') query.Period = p;
    const a = this.filterAchieved();
    if (a === 'achieved')  query.IsAchieved = true;
    if (a === 'inProgress') query.IsAchieved = false;

    const req$ = this.isAdmin()
      ? this.goalsService.getAll(query, force)
      : this.goalsService.getMy(query, force);

    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.goals.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('goals.messages.loadFailed'));
      },
    });
  }

  private loadStats(): void {
    this.statsLoading.set(true);
    this.goalsService.stats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.stats.set(s);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsLoading.set(false);
      },
    });
  }

  // ─────────── filters ───────────

  onSearch(value: string): void {
    this.search.set(value);
    this.searchSubject.next(value);
  }

  setFilterStatus(s: string): void {
    this.filterStatus.set(s as FilterStatus);
  }

  setFilterType(t: string): void {
    this.filterType.set(t as FilterType);
    this.load();
  }

  setFilterPeriod(p: string): void {
    this.filterPeriod.set(p as FilterPeriod);
    this.load();
  }

  setFilterAchieved(a: string): void {
    this.filterAchieved.set(a as FilterAchieved);
    this.load();
  }

  // ─────────── CRUD ───────────

  openCreate(): void { this.formDialog.set('new'); }
  openEdit(goal: Goal): void { this.formDialog.set(goal); }
  closeForm(): void { this.formDialog.set(null); }

  onSaved(saved: Goal): void {
    const exists = this.goals().some(g => g.id === saved.id);
    this.goals.update(list =>
      exists ? list.map(g => g.id === saved.id ? saved : g) : [saved, ...list],
    );
    this.closeForm();
    this.loadStats();
  }

  openDelete(goal: Goal): void { this.deleteDialog.set(goal); }
  closeDelete(): void { this.deleteDialog.set(null); }

  confirmDelete(): void {
    const goal = this.deleteDialog();
    if (!goal) return;
    this.deleting.set(true);
    this.goalsService.delete(goal.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.goals.update(list => list.filter(g => g.id !== goal.id));
        this.deleting.set(false);
        this.closeDelete();
        this.loadStats();
        this.toast.success(this.t('goals.messages.deleteSuccess'));
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error(this.t('goals.messages.deleteFailed'));
      },
    });
  }

  // ─────────── progress update ───────────

  openProgress(goal: Goal): void {
    this.progressGoal.set(goal);
    this.progressInput.set(goal.currentProgress);
  }

  closeProgress(): void {
    this.progressGoal.set(null);
    this.progressInput.set(0);
  }

  submitProgress(): void {
    const g = this.progressGoal();
    const val = this.progressInput();
    if (!g || val < 0) return;

    const wasAchieved = g.isAchieved;
    this.progressUpdating.set(true);

    this.goalsService.updateProgress(g.id, val).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.goals.update(list => list.map(goal => goal.id === updated.id ? updated : goal));
        this.progressUpdating.set(false);
        this.closeProgress();
        this.toast.success(this.t('goals.messages.progressUpdated'));

        if (!wasAchieved && updated.isAchieved) {
          this.celebratingTitle.set(updated.title);
          this.loadStats();
          timer(4500).pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.celebratingTitle.set(null);
          });
        } else {
          this.loadStats();
        }
      },
      error: () => {
        this.progressUpdating.set(false);
        this.toast.error(this.t('goals.messages.progressFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  goalStatus(goal: Goal): GoalStatus {
    const now = Date.now();
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.endDate).getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'expired';
    return 'active';
  }

  /** Time-elapsed percentage (for date progress bar). */
  goalTimeProgress(goal: Goal): number {
    const now = Date.now();
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.endDate).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
  }

  /** Achievement percentage: currentProgress / targetValue × 100. */
  achievementPercent(goal: Goal): number {
    if (!goal.targetValue) return 0;
    return Math.min(100, Math.round((goal.currentProgress / goal.targetValue) * 100));
  }

  /** Preview percent for the progress modal. */
  previewPercent(goal: Goal): number {
    if (!goal.targetValue) return 0;
    return Math.min(100, Math.round((this.progressInput() / goal.targetValue) * 100));
  }

  goalDaysLabel(goal: Goal): string {
    const now = Date.now();
    const start = new Date(goal.startDate).getTime();
    const end = new Date(goal.endDate).getTime();
    const msPerDay = 86_400_000;
    const status = this.goalStatus(goal);
    if (status === 'active') {
      const left = Math.ceil((end - now) / msPerDay);
      return `${left} ${this.t(left === 1 ? 'goals.card.dayLeft' : 'goals.card.daysLeft')}`;
    }
    if (status === 'upcoming') {
      const diff = Math.ceil((start - now) / msPerDay);
      return `${this.t('goals.card.startsIn')} ${diff} ${this.t('goals.card.daysLeft')}`;
    }
    const diff = Math.ceil((now - end) / msPerDay);
    return `${this.t('goals.card.ended')} ${diff} ${this.t('goals.card.daysAgo')}`;
  }

  achievementColor(pct: number): string {
    if (pct >= 100) return '#16a34a';
    if (pct >= 70)  return '#22c55e';
    if (pct >= 40)  return '#f59e0b';
    return '#ef4444';
  }

  periodIcon(period: GoalPeriod): string {
    const map: Record<GoalPeriod, string> = {
      Daily: 'fa-solid fa-sun',
      Weekly: 'fa-solid fa-calendar-week',
      Monthly: 'fa-solid fa-calendar-days',
      Yearly: 'fa-solid fa-calendar',
    };
    return map[period];
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(
        this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch { return iso ?? '—'; }
  }

  formatNumber(n: number | null | undefined): string {
    if (n == null) return '0';
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  // ─────────── goal detail (/Goals/{id}/stats) ───────────

  openGoalDetail(goal: Goal): void {
    this.goalDetailDialog.set(goal);
    this.goalDetailLoading.set(true);
    this.goalsService.getGoalStats(goal.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (fresh) => {
        this.goalDetailDialog.set(fresh);
        this.goalDetailLoading.set(false);
      },
      error: () => { this.goalDetailLoading.set(false); },
    });
  }

  closeGoalDetail(): void { this.goalDetailDialog.set(null); }

  // ─────────── card helpers ───────────

  cardHeaderClass(goal: Goal): string {
    if (goal.isAchieved) return 'gch--achieved';
    const s = this.goalStatus(goal);
    if (s === 'upcoming') return 'gch--upcoming';
    if (s === 'expired')  return 'gch--expired';
    return goal.type === 'Team' ? 'gch--team' : 'gch--individual';
  }

  rankMeta(rank: number): { icon: string; color: string; label: string } {
    if (rank === 1) return { icon: 'fa-solid fa-crown',  color: '#f59e0b', label: 'gold' };
    if (rank === 2) return { icon: 'fa-solid fa-medal',  color: '#94a3b8', label: 'silver' };
    if (rank === 3) return { icon: 'fa-solid fa-award',  color: '#cd7c3b', label: 'bronze' };
    return          { icon: 'fa-solid fa-hashtag', color: '#6b7280', label: '' };
  }

  countByStatus(status: string): number {
    if (status === 'all') return this.goals().length;
    return this.goals().filter(g => this.goalStatus(g) === status).length;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
