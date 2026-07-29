export type GoalType = 'Individual' | 'Team';
export type GoalPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

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
}
