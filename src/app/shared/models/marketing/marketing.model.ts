/** Aggregate KPIs returned by `GET /Marketing/DashboardsStatistics`. */
export interface MarketingDashboardStats {
  customerCost: number;
  activeCampaigns: number;
  todayCustomers: number;
  totalPotentialCustomers: number;
}

/** Per-platform metrics returned by `GET /Marketing/SourcePerformance`. */
export interface SourcePerformanceItem {
  channelSourceId: number;
  sourceName: string;
  customersCount: number;
  totalBudget: number;
}

/** Daily count point returned by `GET /Marketing/potentialCustomersLastdays`. */
export interface DailyCustomersPoint {
  /** ISO date string, e.g. `2026-05-12`. */
  date: string;
  count: number;
}

/** KPIs returned by `GET /Marketing/statistics` (sales-analysis page). */
export interface SalesAnalysisStats {
  totalCustomers: number;
  buyerCustomers: number;
  notBuyerCustomers: number;
  /** Percentage 0–100. */
  conversionRate: number;
}

/** KPIs returned by `GET /Sales/SalesDashboardStatistics`. */
export interface SalesDashboardStats {
  buyerCustomers: number;
  callsToday: number;
  upcomingFollowUps: number;
  overdueFollowUps: number;
  transferredToSupport: number;
  receivedFromMarketing: number;
}

/** Pipeline bucket returned by `GET /Sales/SalesCustomerStatusCount`. */
export interface SalesStatusCount {
  statusId: number;
  /** Raw English enum code (e.g. `Negotiating`, `Buyer`, `NotBuyer`). */
  statusName: string;
  count: number;
}
