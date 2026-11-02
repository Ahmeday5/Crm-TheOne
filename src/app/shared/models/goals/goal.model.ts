export type GoalType = 'Individual' | 'Team';
export type GoalPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

/**
 * Commission bracket a goal currently sits in, by real achievement:
 *
 *   BelowThreshold  achievement <  threshold
 *   UpToTarget      threshold ≤ achievement ≤ 100 %   (exactly 100 % stays here)
 *   AboveTarget     achievement >  100 %
 *
 * The bracket's rate applies to the *whole* collected amount, not only the
 * part above a boundary.
 */
export type CommissionTier = 'BelowThreshold' | 'UpToTarget' | 'AboveTarget';

/** The three commission rates (%) an admin sets on a goal; `null` = not set. */
export interface GoalCommissionRates {
  /** Rate below `commissionThresholdPercent`. */
  commissionRateBelowThreshold: number | null;
  /** Rate from the threshold up to and including 100 % of the target. */
  commissionRateUpToTarget: number | null;
  /** Rate once the target is exceeded. */
  commissionRateAboveTarget: number | null;
}

/**
 * One logged amount on a goal (`GET /Goals/{id}` → `progressEntries`,
 * newest first). Amounts logged before entries were introduced are not
 * listed, so `currentProgress` may exceed the sum of the entries.
 */
export interface GoalProgressEntry {
  id: number;
  userId: string;
  fullName: string;
  value: number;
  details: string;
  /** Server-relative proof-of-payment image, `null` when none was attached. */
  attachmentUrl: string | null;
  /** UTC timestamp. */
  contributedAt: string;
}

/** One person's proportional share of a `Team` goal's progress + reward. */
export interface GoalContributor {
  userId: string;
  fullName: string;
  contributionValue: number;
  contributionPercent: number;
  earnedPoints: number;
  earnedReward: number;
  /** This person's commission = goal's `currentCommissionRate` × `contributionValue`. */
  commissionAmount?: number | null;
}

export interface Goal extends GoalCommissionRates {
  id: number;
  title: string;
  description: string;
  type: GoalType;
  period: GoalPeriod;
  targetValue: number;
  points: number;
  financialReward: number;
  startDate: string;
  endDate: string;
  /** Can exceed `targetValue` — Sales keep logging after the goal is achieved. */
  currentProgress: number;
  isAchieved: boolean;
  achievedAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  createdAt: string;

  /** `currentProgress / targetValue * 100`, capped at 100 — use for progress bars. */
  progressPercent: number;
  /** Real achievement, uncapped (e.g. `120.0`) — use to display the figure. */
  achievementPercent?: number;
  /** Points earned so far, prorated by `progressPercent` of the full `points`. */
  earnedPoints: number;
  /** Reward earned so far, prorated by `progressPercent` of the full `financialReward`. */
  earnedReward: number;
  /** Per-person breakdown of who contributed how much — populated for `Team` goals only. */
  contributors: GoalContributor[];

  /** Minimum achievement % (1–100) to reach the `UpToTarget` bracket; `null` = no threshold. */
  commissionThresholdPercent: number | null;
  /** `true` once the achievement reaches the threshold, or when there is none. */
  isCommissionEligible: boolean;
  /** Bracket the goal is in now; absent on servers without tiered commission. */
  commissionTier?: CommissionTier | null;
  /** The bracket's rate (%) applied right now. */
  currentCommissionRate?: number | null;
  /** Commission so far = `currentCommissionRate` × `currentProgress`. */
  commissionAmount?: number | null;
  /** Logged amounts, newest first — returned by `GET /Goals/{id}` only. */
  progressEntries?: GoalProgressEntry[];
}

export interface CreateGoalRequest {
  title: string;
  description: string;
  type: GoalType;
  period: GoalPeriod;
  targetValue: number;
  points: number;
  financialReward: number;
  startDate: string;
  endDate: string;
  assignedToId: string | null;
  /** Optional whole number 1–100; omit/`null` for "no commission threshold". */
  commissionThresholdPercent?: number | null;
  /** Optional 0–100, decimals allowed (e.g. `2.5`). */
  commissionRateBelowThreshold?: number | null;
  commissionRateUpToTarget?: number | null;
  commissionRateAboveTarget?: number | null;
}

export interface UpdateGoalRequest {
  title: string;
  description: string;
  period: GoalPeriod;
  targetValue: number;
  points: number;
  financialReward: number;
  startDate: string;
  endDate: string;
  commissionThresholdPercent?: number | null;
  commissionRateBelowThreshold?: number | null;
  commissionRateUpToTarget?: number | null;
  commissionRateAboveTarget?: number | null;
}

/** `PATCH /Goals/{id}/progress` (Sales) — sent as multipart/form-data. */
export interface AddGoalProgressRequest {
  /** Amount to add, integer ≥ 1. */
  value: number;
  /** What this amount is for, ≤ 1000 chars. */
  details: string;
  /** Optional proof-of-payment image. */
  attachment?: File | null;
}

/**
 * `PUT /Goals/progress-entries/{entryId}` (Admin) — multipart/form-data.
 * Every field is optional; only the changed ones are sent. On an achieved
 * goal the server answers 400 (with a message) if the change would drop
 * `currentProgress` below `targetValue`.
 */
export interface UpdateGoalProgressEntryRequest {
  value?: number;
  details?: string;
  attachment?: File | null;
  removeAttachment?: boolean;
}

export interface GoalListQuery {
  Search?: string;
  Type?: GoalType;
  Period?: GoalPeriod;
  IsAchieved?: boolean;
}

export interface GoalPointsBreakdownItem {
  goalId: number;
  goalTitle: string;
  goalType: GoalType;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  pointsEarned: number;
  rewardEarned: number;
  achievedAt: string;
  userName: string;
}

export interface GoalStats {
  totalGoals: number;
  individualGoals: number;
  teamGoals: number;
  achievedGoals: number;
  inProgressGoals: number;
  totalPointsAwarded: number;
  pointsBreakdown: GoalPointsBreakdownItem[];
}

/** Query params for `GET /Goals/Leaderboard`. */
export interface GoalLeaderboardQuery {
  GoalType?: GoalType;
  From?: string;
  To?: string;
  /** Admin only — scope the board to a single person. */
  UserId?: string;
}

/** One row of `GET /Goals/Leaderboard`. */
export interface GoalLeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  totalPoints: number;
  totalReward: number;
  goalsAchieved: number;
  imageUrl?: string | null;
}
