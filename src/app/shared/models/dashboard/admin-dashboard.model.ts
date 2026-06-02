/**
 * Models for the admin/manager landing dashboard
 * (`GET /AdminDashboard`).
 */

/** A single KPI tile: current count + month-over-month change. */
export interface AdminDashboardMetric {
  count: number;
  /** Signed percentage change vs. the previous month (e.g. 50 = +50%). */
  changePercent: number;
}

/** Contract-revenue summary block. */
export interface AdminContractsRevenue {
  /** Sum of all contract values in the system. */
  totalValue: number;
  /** Sum of currently-active contract values. */
  activeValue: number;
  /** Average value per contract. */
  averageValue: number;
  /** Number of currently-active contracts. */
  activeCount: number;
}

/** One point on the monthly-buyers (sales-conversion) trend. */
export interface AdminMonthlyBuyersPoint {
  year: number;
  /** 1–12. */
  month: number;
  /** Localized month name as served by the backend (Arabic). */
  monthName: string;
  count: number;
}

/** One point on the monthly-revenue trend. */
export interface AdminMonthlyRevenuePoint {
  year: number;
  /** 1–12. */
  month: number;
  /** Localized month name as served by the backend (Arabic). */
  monthName: string;
  revenue: number;
}

/** Full payload returned by `GET /AdminDashboard` (the `data` envelope). */
export interface AdminDashboardData {
  buyers: AdminDashboardMetric;
  nonBuyers: AdminDashboardMetric;
  activeProjects: AdminDashboardMetric;
  pendingTasks: AdminDashboardMetric;
  contractsRevenue: AdminContractsRevenue;
  monthlyBuyers: AdminMonthlyBuyersPoint[];
  monthlyRevenue: AdminMonthlyRevenuePoint[];
}
