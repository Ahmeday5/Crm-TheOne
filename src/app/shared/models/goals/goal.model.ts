export type GoalType = 'Individual' | 'Team';
export type GoalPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

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
