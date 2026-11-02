import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommissionTier, Goal } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CommissionRangePipe } from '../../pipes/commission-range.pipe';
import {
  COMMISSION_TIERS,
  buildCommissionInsight,
  goalAchievementPercent,
  goalBarPercent,
  goalOverTargetPercent,
  hasCommissionRates,
  rateForTier,
} from '../../utils/goal-commission.util';
import { GoalCommissionNextComponent } from '../goal-commission-next/goal-commission-next.component';

/** Where the employee stands — drives the accent colour and status line. */
export type CommissionStage = 'below' | 'eligible' | 'achieved' | 'above';

interface LegendRow {
  tier: CommissionTier;
  rate: number | null;
  current: boolean;
}

const STAGE_KEY: Record<CommissionStage, string> = {
  below: 'goals.commissionGuide.stageBelow',
  eligible: 'goals.commissionGuide.stageEligible',
  achieved: 'goals.commissionGuide.stageAchieved',
  above: 'goals.commissionGuide.stageAbove',
};

/**
 * Explains a goal's pay-out rules to the employee and shows where they are:
 * the commission earned so far, a segmented meter (with the threshold tick),
 * the brackets with their rates — current one highlighted — and what the
 * next bracket would pay. The fixed reward (money + points) is earned once,
 * at 100 %.
 *
 * Figures come from `buildCommissionInsight` (server fields first). Goals
 * without rates keep the legacy wording ("commission earned" from the
 * threshold up) and a plain "X left" line.
 */
@Component({
  selector: 'app-goal-commission-guide',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe, PercentLabelPipe, CommissionRangePipe, GoalCommissionNextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-inverse]': 'tone() === "inverse"' },
  templateUrl: './goal-commission-guide.component.html',
  styleUrl: './goal-commission-guide.component.scss',
})
export class GoalCommissionGuideComponent {
  readonly goal = input.required<Goal>();
  /** `inverse` = light-on-dark, for use on the gradient goal banner. */
  readonly tone = input<'surface' | 'inverse'>('surface');
  /** Signed-in employee — on a team goal their own share is shown. */
  readonly viewerUserId = input<string | null>(null);

  protected readonly threshold = computed(() => this.goal().commissionThresholdPercent ?? null);
  protected readonly hasRates = computed(() => hasCommissionRates(this.goal()));
  protected readonly commission = computed(() =>
    buildCommissionInsight(this.goal(), this.viewerUserId()),
  );

  protected readonly barPercent = computed(() => goalBarPercent(this.goal()));
  protected readonly overTarget = computed(() => goalOverTargetPercent(this.goal()));
  private readonly notStarted = computed(() => goalAchievementPercent(this.goal()) <= 0);

  protected readonly stage = computed<CommissionStage>(() => {
    const goal = this.goal();
    const tier = this.commission().tier;
    if (tier === 'AboveTarget') return 'above';
    if (goal.isAchieved || goal.currentProgress >= goal.targetValue) return 'achieved';
    if (this.notStarted()) return 'below';
    return tier === 'UpToTarget' ? 'eligible' : 'below';
  });

  protected readonly stageKey = computed(() =>
    this.notStarted() ? 'goals.commissionGuide.stageNotStarted' : STAGE_KEY[this.stage()],
  );

  /** Amount still needed to reach the commission threshold (0 once reached). */
  protected readonly toThreshold = computed(() => {
    const g = this.goal();
    const t = this.threshold();
    if (t === null) return 0;
    return Math.max(0, Math.ceil((g.targetValue * t) / 100) - g.currentProgress);
  });

  /** Amount still needed to hit the target (0 once achieved). */
  protected readonly toTarget = computed(() =>
    Math.max(0, this.goal().targetValue - this.goal().currentProgress),
  );

  /** Show "any extra amount moves you up" only if the top bracket pays something. */
  protected readonly canEarnAbove = computed(
    () => rateForTier(this.goal(), 'AboveTarget') !== null,
  );

  /** Without a threshold the "below" bracket can't be reached, so it's not listed. */
  protected readonly legend = computed<LegendRow[]>(() => {
    const goal = this.goal();
    const current = this.notStarted() && this.threshold() === null ? null : this.commission().tier;
    return COMMISSION_TIERS
      .filter((tier) => tier !== 'BelowThreshold' || this.threshold() !== null)
      .map((tier) => ({ tier, rate: rateForTier(goal, tier), current: tier === current }));
  });
}
