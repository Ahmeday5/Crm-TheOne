import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommissionTier, Goal } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CommissionRangePipe } from '../../pipes/commission-range.pipe';
import {
  COMMISSION_TIERS,
  buildCommissionInsight,
  hasCommissionRates,
  rateForTier,
} from '../../utils/goal-commission.util';
import { GoalCommissionNextComponent } from '../goal-commission-next/goal-commission-next.component';

interface TierRow {
  tier: CommissionTier;
  rate: number | null;
  current: boolean;
}

const TIER_ICON: Record<CommissionTier, string> = {
  BelowThreshold: 'fa-solid fa-hourglass-half',
  UpToTarget: 'fa-solid fa-circle-check',
  AboveTarget: 'fa-solid fa-rocket',
};

/**
 * "Commission" block for a goal, written so anyone can read it at a glance:
 *
 *   Your commission so far
 *   250 EGP
 *   1% of total collected (25,000 EGP)
 *   ┌ Next tier: 10,000 EGP left to reach the threshold →
 *   └ rate becomes 3% and commission 1,050 EGP (+800 EGP)
 *   • brackets, current one highlighted
 *
 * `viewer` picks the voice ("your commission" vs "commission earned");
 * `viewerUserId` lets a team-goal contributor see their own share.
 * Renders nothing when the goal has no commission rates — callers that add
 * spacing around it should guard with `hasCommissionRates` themselves.
 */
@Component({
  selector: 'app-goal-commission-summary',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe, PercentLabelPipe, CommissionRangePipe, GoalCommissionNextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-compact]': 'density() === "compact"' },
  templateUrl: './goal-commission-summary.component.html',
  styleUrl: './goal-commission-summary.component.scss',
})
export class GoalCommissionSummaryComponent {
  readonly goal = input.required<Goal>();
  /** `compact` = tighter spacing for goal cards. */
  readonly density = input<'comfortable' | 'compact'>('comfortable');
  /** `self` = the employee looking at their own goal; `manager` = an admin. */
  readonly viewer = input<'self' | 'manager'>('self');
  readonly viewerUserId = input<string | null>(null);

  protected readonly visible = computed(() => hasCommissionRates(this.goal()));
  protected readonly threshold = computed(() => this.goal().commissionThresholdPercent ?? null);
  protected readonly insight = computed(() => buildCommissionInsight(this.goal(), this.viewerUserId()));
  protected readonly tierIcon = computed(() => TIER_ICON[this.insight().tier]);

  protected readonly headlineKey = computed(
    () => `goals.commission.earnedSoFar.${this.insight().scope}.${this.viewer()}`,
  );

  /** Without a threshold the "below" bracket can't be reached, so it's not listed. */
  protected readonly rows = computed<TierRow[]>(() => {
    const goal = this.goal();
    const current = this.insight().tier;
    return COMMISSION_TIERS
      .filter((tier) => tier !== 'BelowThreshold' || this.threshold() !== null)
      .map((tier) => ({ tier, rate: rateForTier(goal, tier), current: tier === current }));
  });
}
