import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Goal } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { achievementPercent } from '../../utils/goal-progress.util';

/** Where the employee stands against the commission rules. */
export type CommissionStage = 'below' | 'eligible' | 'achieved';

interface CommissionTier {
  stage: CommissionStage;
  /** Range label pieces, e.g. "أقل من" + 70%. */
  rangeKey: string;
  rangePct: number | null;
  resultKey: string;
}

/**
 * Explains a goal's pay-out rules to the employee and shows where they are:
 *
 *   below threshold      → no commission
 *   threshold … < 100 %  → commission
 *   100 % or more        → commission + reward (money + points)
 *
 * All three tiers are always shown — from 0 %, before anything is logged.
 * The current tier is highlighted and the remaining amount to the next
 * milestone is spelled out. Without a threshold the first two tiers read
 * "no progress yet" / "any progress".
 *
 * The stage is derived from the actual achievement rather than the
 * server's `isCommissionEligible`: that flag is `true` for every goal
 * without a threshold — even at 0 % — which would congratulate an
 * employee who hasn't logged anything.
 */
@Component({
  selector: 'app-goal-commission-guide',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-inverse]': 'tone() === "inverse"' },
  templateUrl: './goal-commission-guide.component.html',
  styleUrl: './goal-commission-guide.component.scss',
})
export class GoalCommissionGuideComponent {
  readonly goal = input.required<Goal>();
  /** `inverse` = light-on-dark, for use on the gradient goal banner. */
  readonly tone = input<'surface' | 'inverse'>('surface');

  protected readonly threshold = computed(() => this.goal().commissionThresholdPercent ?? null);

  /** Exact achievement (unrounded, unclamped) — drives the tier logic. */
  private readonly exactPercent = computed(() => {
    const g = this.goal();
    return g.targetValue ? (g.currentProgress / g.targetValue) * 100 : 0;
  });

  protected readonly barPercent = computed(() =>
    achievementPercent(this.goal().currentProgress, this.goal().targetValue),
  );

  protected readonly stage = computed<CommissionStage>(() => {
    const pct = this.exactPercent();
    if (this.goal().isAchieved || pct >= 100) return 'achieved';
    const t = this.threshold();
    const eligible = t === null ? pct > 0 : pct >= t;
    return eligible ? 'eligible' : 'below';
  });

  /** Amount still needed to reach the commission threshold (0 once reached). */
  protected readonly toThreshold = computed(() => {
    const g = this.goal();
    const t = this.threshold();
    if (t === null) return 0;
    return Math.max(0, Math.ceil((g.targetValue * t) / 100) - g.currentProgress);
  });

  /** Amount still needed to complete the goal (0 once achieved). */
  protected readonly toFull = computed(() =>
    Math.max(0, this.goal().targetValue - this.goal().currentProgress),
  );

  protected readonly tiers = computed<CommissionTier[]>(() => {
    const t = this.threshold();
    return [
      {
        stage: 'below',
        rangeKey: t === null ? 'goals.commissionGuide.noProgress' : 'goals.commissionGuide.below',
        rangePct: t,
        resultKey: 'goals.commissionGuide.noCommission',
      },
      {
        stage: 'eligible',
        rangeKey: t === null ? 'goals.commissionGuide.anyProgress' : 'goals.commissionGuide.from',
        rangePct: t,
        resultKey: 'goals.commissionGuide.commission',
      },
      {
        stage: 'achieved',
        rangeKey: 'goals.commissionGuide.fullTarget',
        rangePct: null,
        resultKey: 'goals.commissionGuide.commissionAndReward',
      },
    ];
  });

  protected readonly stageKey = computed(() => {
    switch (this.stage()) {
      case 'achieved': return 'goals.commissionGuide.stageAchieved';
      case 'eligible': return 'goals.commissionGuide.stageEligible';
      default:
        return this.exactPercent() === 0
          ? 'goals.commissionGuide.stageNotStarted'
          : 'goals.commissionGuide.stageBelow';
    }
  });
}
