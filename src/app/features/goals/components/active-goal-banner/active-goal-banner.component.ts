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
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Goal } from '../../../../shared/models';
import { GoalsService } from '../../services/goals.service';

/**
 * Personal "active goal" banner + header pill, backed by `GET /Goals/active`.
 * That endpoint returns only the caller's own currently-active goal(s) — the
 * backend deletes a goal the moment its end date passes, so this list is
 * inherently short-lived and refreshed on an interval to catch that removal.
 */
@Component({
  selector: 'app-active-goal-banner',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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
  private readonly destroy$ = new Subject<void>();

  /** Re-poll interval — cheap enough, and catches server-side auto-expiry. */
  private readonly REFRESH_MS = 60_000;

  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);
  readonly dismissed = signal(false);

  readonly primaryGoal = computed<Goal | null>(() => this.goals()[0] ?? null);
  readonly hasActiveGoal = computed(() => !this.dismissed() && this.goals().length > 0);
  readonly extraCount = computed(() => Math.max(0, this.goals().length - 1));

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

  achievementPercent(goal: Goal): number {
    if (!goal.targetValue) return 0;
    return Math.min(100, Math.round((goal.currentProgress / goal.targetValue) * 100));
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
