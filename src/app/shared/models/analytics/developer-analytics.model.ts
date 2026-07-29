/**
 * Models for the `DeveloperAnalytics/*` endpoints that back the
 * "Development team analytics" page. `GET /DeveloperAnalytics` takes
 * `Period` (numeric `AnalyticsPeriod` enum), `ProjectId` and — admin only —
 * `DeveloperId` as query params; the server applies the filters.
 */

/** `AnalyticsPeriod` — numeric enum the backend expects for the `Period` query param. */
export enum AnalyticsPeriod {
  Week = 0,
  Month = 1,
  Quarter = 2,
  HalfYear = 3,
  Year = 4,
}

/** One project option for the `ProjectId` filter dropdown. */
export interface DeveloperAnalyticsProjectOption {
  id: number;
  name: string;
}

/** A "best in class" highlight (most productive / fastest / top performer). */
export interface AnalyticsHighlight {
  developerId: string;
  fullName: string;
  value: number;
  /** Server-provided, already-localized caption (e.g. "معدل الإنتاجية"). */
  label: string;
}

/** Payload of `GET /DeveloperAnalytics/Summary` — the KPI strip + highlights. */
export interface DeveloperAnalyticsSummary {
  productivityRate: number;
  productivityChangePercent: number;
  resolvedBugs: number;
  openBugs: number;
  avgCompletionTimeHours: number;
  completedTasks: number;
  completedTasksChangePercent: number;
  mostProductive: AnalyticsHighlight | null;
  fastest: AnalyticsHighlight | null;
  topPerformer: AnalyticsHighlight | null;
}

/** One row of `GET /DeveloperAnalytics/DeveloperStats` (the per-developer table). */
export interface DeveloperStatRow {
  developerId: string;
  fullName: string;
  completedTasks: number;
  avgCompletionTimeHours: number;
  resolvedBugs: number;
  currentWorkloadPercent: number;
  productivityPercent: number;
}

/** One point in the "task completion over time" line chart. */
export interface TaskCompletionPoint {
  day: string;
  completed: number;
  pending: number;
}

/** One bar in the "projects progress" chart. */
export interface ProjectProgressPoint {
  projectId: number;
  projectName: string;
  progress: number;
}

/** Payload of `GET /DeveloperAnalytics/Charts`. */
export interface DeveloperAnalyticsCharts {
  taskCompletionOverTime: TaskCompletionPoint[];
  projectsProgress: ProjectProgressPoint[];
}

/**
 * One slice of the "bugs by project" distribution. The exact field set isn't
 * pinned by the swagger (the sample array was empty), so numeric fields are
 * optional and read defensively at the call-site.
 */
export interface BugDistributionPoint {
  projectId?: number;
  projectName: string;
  count?: number;
  bugCount?: number;
  openBugs?: number;
  resolvedBugs?: number;
}

/** One group in the "open vs resolved bugs by month" chart. */
export interface MonthlyBugPoint {
  month: string;
  open: number;
  resolved: number;
}

/** Payload of `GET /DeveloperAnalytics/BugAnalytics`. */
export interface BugAnalytics {
  distributionByProject: BugDistributionPoint[];
  monthlyOpenVsResolved: MonthlyBugPoint[];
}

/** Combined payload of `GET /DeveloperAnalytics`. */
export interface DeveloperAnalyticsAll {
  summary: DeveloperAnalyticsSummary;
  developerStats: DeveloperStatRow[];
  charts: DeveloperAnalyticsCharts;
  bugAnalytics: BugAnalytics;
}
