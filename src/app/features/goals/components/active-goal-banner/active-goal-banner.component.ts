import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, timer } from 'rxjs';
import { onCacheInvalidated } from '../../../../core/http/cache-invalidation.util';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Goal } from '../../../../shared/models';
import { GoalsService } from '../../services/goals.service';
import {
  CommissionInsight,
  buildCommissionInsight,
  goalAchievementPercent,
  hasCommissionRates,
} from '../../utils/goal-commission.util';
import { GoalCommissionGuideComponent } from '../goal-commission-guide/goal-commission-guide.component';

/**
 * Personal "active goal" banner + header pill, backed by `GET /Goals/active`.
 * That endpoint returns only the caller's own currently-active goal(s) — the
 * backend deletes a goal the moment its end date passes, so this list is
 * inherently short-lived and refreshed on an interval to catch that removal.
 */
@Component({
  selector: 'app-active-goal-banner',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MoneyPipe, PercentLabelPipe, ClampTextDirective, GoalCommissionGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './active-goal-banner.component.html',
  styleUrl: './active-goal-banner.component.scss',
})
export class ActiveGoalBannerComponent implements OnInit, OnDestroy {
  /** `banner` = full-width hero card. `pill` = compact header badge that opens the banner on click. */
  @Input() variant: 'banner' | 'pill' = 'banner';

  private readonly goalsService = inject(GoalsService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  /** Re-poll interval — cheap enough, and catches server-side auto-expiry. */
  private readonly REFRESH_MS = 60_000;

  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);
  readonly dismissed = signal(false);

  readonly primaryGoal = computed<Goal | null>(() => this.goals()[0] ?? null);
  readonly hasActiveGoal = computed(() => !this.dismissed() && this.goals().length > 0);
  readonly extraCount = computed(() => Math.max(0, this.goals().length - 1));

  readonly viewerUserId = computed(() => this.auth.currentUser()?.userId ?? null);
  /** Commission on the primary goal — `null` when it has no rates. */
  readonly primaryCommission = computed<CommissionInsight | null>(() => {
    const goal = this.primaryGoal();
    return goal && hasCommissionRates(goal) ? buildCommissionInsight(goal, this.viewerUserId()) : null;
  });

  constructor() {
    // Host page's "refresh data" (or a goal mutation) dropped our cache.
    onCacheInvalidated('Goals', () => this.load(true));
  }

  ngOnInit(): void {
    this.load();
    timer(this.REFRESH_MS, this.REFRESH_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(force = false): void {
    this.goalsService.getActive(force).pipe(takeUntil(this.destroy$)).subscribe({
      next: (goals) => {
        this.goals.set(goals ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  dismiss(): void {
    this.dismissed.set(true);
  }

  viewGoal(): void {
    this.router.navigate(['/goals']);
  }

  /** Real achievement — may exceed 100 once Sales log past the target. */
  achievementPercent(goal: Goal): number {
    return goalAchievementPercent(goal);
  }

  daysLeft(goal: Goal): number {
    const end = new Date(goal.endDate).getTime();
    const msPerDay = 86_400_000;
    return Math.max(0, Math.ceil((end - Date.now()) / msPerDay));
  }

  isUrgent(goal: Goal): boolean {
    return this.daysLeft(goal) <= 2;
  }

  formatNumber(n: number | null | undefined): string {
    if (n == null) return '0';
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }
}
