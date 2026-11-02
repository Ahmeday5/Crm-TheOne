import {
  CommissionTier,
  Goal,
  GoalCommissionRates,
} from '../../../shared/models';

/**
 * Tiered goal commission — the single client-side source of truth for the
 * rules the server applies:
 *
 *   achievement <  threshold        → `BelowThreshold` rate
 *   threshold ≤ achievement ≤ 100 % → `UpToTarget` rate
 *   achievement >  100 %            → `AboveTarget` rate
 *
 * The bracket's rate is applied to the *whole* collected amount. Reaching a
 * boundary exactly moves into the higher bracket, except 100 % which stays
 * in `UpToTarget`.
 *
 * Views read the server's computed fields (`commissionTier`,
 * `commissionAmount`, …) through `goalCommissionState`; `quoteCommission`
 * is only for "what if" previews (goal form, logging an amount).
 */

/** Brackets in ascending order — the order they are listed in the UI. */
export const COMMISSION_TIERS: readonly CommissionTier[] = [
  'BelowThreshold',
  'UpToTarget',
  'AboveTarget',
];

/** Which rate field drives each bracket. */
export const COMMISSION_RATE_FIELD: Readonly<Record<CommissionTier, keyof GoalCommissionRates>> = {
  BelowThreshold: 'commissionRateBelowThreshold',
  UpToTarget: 'commissionRateUpToTarget',
  AboveTarget: 'commissionRateAboveTarget',
};

export const COMMISSION_RATE_MIN = 0;
export const COMMISSION_RATE_MAX = 100;

/** Rate: empty, or any number 0–100 (decimals allowed, e.g. 2.5). */
export function isValidCommissionRate(value: number | null): boolean {
  return (
    value === null ||
    (Number.isFinite(value) && value >= COMMISSION_RATE_MIN && value <= COMMISSION_RATE_MAX)
  );
}

/** Threshold: empty, or a whole number 1–100. */
export function isValidCommissionThreshold(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 100);
}

/** `true` when at least one rate is set — otherwise commission UI is hidden. */
export function hasCommissionRates(rates: Partial<GoalCommissionRates>): boolean {
  return COMMISSION_TIERS.some((tier) => rates[COMMISSION_RATE_FIELD[tier]] != null);
}

export function rateForTier(rates: Partial<GoalCommissionRates>, tier: CommissionTier): number | null {
  return rates[COMMISSION_RATE_FIELD[tier]] ?? null;
}

/**
 * Bracket for an amount collected against a target. Compared on amounts
 * (not a derived %) so float noise like `0.7 * 100 = 70.000…01` can't flip
 * a boundary.
 */
export function resolveCommissionTier(
  collected: number,
  targetValue: number,
  thresholdPercent: number | null,
): CommissionTier {
  if (collected > targetValue) return 'AboveTarget';
  if (thresholdPercent !== null && collected * 100 < targetValue * thresholdPercent) {
    return 'BelowThreshold';
  }
  return 'UpToTarget';
}

export interface CommissionQuote {
  tier: CommissionTier;
  /** Rate applied; `null` when that bracket has no rate (pays nothing). */
  rate: number | null;
  /** Commission in currency, rounded to 2 decimals. */
  amount: number;
  /** Real achievement %, uncapped. */
  achievementPercent: number;
}

/** What `collected` would earn under the given rules. */
export function quoteCommission(
  collected: number,
  targetValue: number,
  thresholdPercent: number | null,
  rates: Partial<GoalCommissionRates>,
): CommissionQuote {
  const tier = resolveCommissionTier(collected, targetValue, thresholdPercent);
  const rate = rateForTier(rates, tier);
  return {
    tier,
    rate,
    amount: commissionOf(collected, rate),
    achievementPercent: targetValue > 0 ? (collected / targetValue) * 100 : 0,
  };
}

/** Over-target achievement used to illustrate the top bracket in previews. */
const PREVIEW_ABOVE_TARGET_PERCENT = 120;

/**
 * Achievement points that walk through every bracket for a "what would they
 * earn" preview: just under the threshold, the threshold itself, exactly
 * 100 % and above target — e.g. 70 → [60, 70, 100, 120].
 */
export function commissionPreviewPercents(thresholdPercent: number | null): number[] {
  const points =
    thresholdPercent === null
      ? [50, 100]
      : [thresholdPercent > 10 ? thresholdPercent - 10 : thresholdPercent / 2, thresholdPercent, 100];
  return [...new Set([...points, PREVIEW_ABOVE_TARGET_PERCENT])];
}

/** Real (uncapped) achievement — the server figure, or derived for older payloads. */
export function goalAchievementPercent(goal: Goal): number {
  if (typeof goal.achievementPercent === 'number') return goal.achievementPercent;
  return goal.targetValue > 0 ? (goal.currentProgress / goal.targetValue) * 100 : 0;
}

/** Progress-bar width, 0–100. */
export function goalBarPercent(goal: Goal): number {
  const pct =
    typeof goal.progressPercent === 'number' ? goal.progressPercent : goalAchievementPercent(goal);
  return Math.min(100, Math.max(0, pct));
}

/** How far past the target the goal is, in % points (0 when not exceeded). */
export function goalOverTargetPercent(goal: Goal): number {
  return Math.max(0, goalAchievementPercent(goal) - 100);
}

export interface GoalCommissionState {
  tier: CommissionTier;
  rate: number | null;
  amount: number;
  eligible: boolean;
}

/**
 * The goal's commission right now. Server fields win; anything missing is
 * derived with the same rules so the UI stays consistent.
 */
export function goalCommissionState(goal: Goal): GoalCommissionState {
  const quote = quoteCommission(
    goal.currentProgress,
    goal.targetValue,
    goal.commissionThresholdPercent,
    goal,
  );
  const tier = goal.commissionTier ?? quote.tier;
  return {
    tier,
    rate: goal.currentCommissionRate ?? rateForTier(goal, tier),
    amount: goal.commissionAmount ?? quote.amount,
    eligible: goal.isCommissionEligible ?? tier !== 'BelowThreshold',
  };
}

/**
 * Whose money the figures describe:
 *  - `goal`     an individual goal — its owner's commission
 *  - `personal` a team goal seen by a contributor — their own share
 *  - `team`     a team goal seen by a manager (or a non-contributor) — the team total
 */
export type CommissionScope = 'goal' | 'personal' | 'team';

/** The next bracket that pays more than the current one. */
export interface CommissionMilestone {
  tier: CommissionTier;
  rate: number;
  /** Goal total where the bracket starts (`AboveTarget`: anything beyond it). */
  atTotal: number;
  /** Still to collect to get there (0 = any further amount). */
  remaining: number;
  /** Commission once there — a lower bound for `AboveTarget`. */
  projectedAmount: number;
  /** `projectedAmount` minus what is earned now. */
  gain: number;
}

export interface CommissionInsight {
  tier: CommissionTier;
  rate: number | null;
  /** Earned so far, in currency, for the `scope`. */
  amount: number;
  /** What the rate is applied to (collected total, or a contributor's share). */
  base: number;
  scope: CommissionScope;
  next: CommissionMilestone | null;
}

/**
 * Everything a viewer needs to understand a goal's commission: what they
 * earned, how (`rate × base`), and what the next bracket would pay.
 *
 * Pass the viewer's id so a contributor to a team goal sees their own share
 * (`commissionAmount` of their `contributors` row) instead of the team total.
 */
export function buildCommissionInsight(goal: Goal, viewerUserId?: string | null): CommissionInsight {
  const state = goalCommissionState(goal);
  const contributor =
    goal.type === 'Team' && viewerUserId
      ? goal.contributors?.find((c) => c.userId === viewerUserId)
      : undefined;

  const scope: CommissionScope = goal.type !== 'Team' ? 'goal' : contributor ? 'personal' : 'team';
  const base = contributor ? contributor.contributionValue : goal.currentProgress;
  const amount = contributor
    ? contributor.commissionAmount ?? commissionOf(base, state.rate)
    : state.amount;

  return {
    tier: state.tier,
    rate: state.rate,
    amount,
    base,
    scope,
    next: nextMilestone(goal, state, amount, contributor ? base : null),
  };
}

/**
 * First bracket above the current one whose rate beats the current rate.
 * `personalBase` (a contributor's share) replaces the goal total when
 * projecting — a contributor is paid on their share, not on the team's.
 */
function nextMilestone(
  goal: Goal,
  state: GoalCommissionState,
  currentAmount: number,
  personalBase: number | null,
): CommissionMilestone | null {
  const threshold = goal.commissionThresholdPercent;
  const currentRate = state.rate ?? 0;

  for (const tier of COMMISSION_TIERS.slice(COMMISSION_TIERS.indexOf(state.tier) + 1)) {
    const rate = rateForTier(goal, tier);
    if (rate === null || rate <= currentRate) continue;
    if (tier === 'UpToTarget' && threshold === null) continue;

    const atTotal =
      tier === 'UpToTarget' ? Math.ceil((goal.targetValue * threshold!) / 100) : goal.targetValue;
    const projectedAmount = commissionOf(personalBase ?? atTotal, rate);
    return {
      tier,
      rate,
      atTotal,
      remaining: Math.max(0, atTotal - goal.currentProgress),
      projectedAmount,
      gain: roundMoney(Math.max(0, projectedAmount - currentAmount)),
    };
  }
  return null;
}

function commissionOf(base: number, rate: number | null): number {
  return roundMoney((base * (rate ?? 0)) / 100);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
