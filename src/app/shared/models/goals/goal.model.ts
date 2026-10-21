export type GoalType = 'Individual' | 'Team';
export type GoalPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

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
}

export interface Goal {
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
  currentProgress: number;
  isAchieved: boolean;
  achievedAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  createdAt: string;

  /** `currentProgress / targetValue * 100`, already computed server-side. */
  progressPercent: number;
  /** Points earned so far, prorated by `progressPercent` of the full `points`. */
  earnedPoints: number;
  /** Reward earned so far, prorated by `progressPercent` of the full `financialReward`. */
  earnedReward: number;
  /** Per-person breakdown of who contributed how much — populated for `Team` goals only. */
  contributors: GoalContributor[];

  /** Minimum achievement % (1–100) required to earn commission; `null` = no threshold. */
  commissionThresholdPercent: number | null;
  /** `true` once `progressPercent` reaches the threshold, or when there is none. */
  isCommissionEligible: boolean;
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
  /** Optional 1–100; omit/`null` for "no commission threshold". */
  commissionThresholdPercent?: number | null;
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
 * Every field is optional; only the changed ones are sent. `value` is
 * rejected by the server once the goal is achieved.
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
