/**
 * Domain types for the `Reports/*` (daily reports) endpoints.
 *
 * Two backend list shapes share the same query/page envelope:
 *   - `GET /Reports`         — all reports (admin-only)
 *   - `GET /Reports/myreports` — caller's reports
 *
 * The list rows are a lightweight projection (`DailyReportListItem`) — the
 * full body is returned only from the detail endpoint.
 */

/** Lightweight row returned by the list endpoints. */
export interface DailyReportListItem {
  id: number;
  reportDate: string;
  userName: string;
  workHours: number;
  completedTasksPreview: string;
  createdAt: string;
}

/** Full detail returned by `GET /Reports/{id}` (and `POST` / `PUT` responses). */
export interface DailyReport {
  id: number;
  reportDate: string;
  completedTasks: string;
  tasksInProgress: string;
  plannedTasks: string;
  challenges: string;
  workHours: number;
  additionalNotes: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string | null;
}

/** Body shared by `POST /Reports` and `PUT /Reports/{id}`. */
export interface DailyReportRequest {
  reportDate: string;
  completedTasks: string;
  tasksInProgress: string;
  plannedTasks: string;
  challenges: string;
  workHours: number;
  additionalNotes: string;
}

/** Query params for list / my-reports. Server applies pagination + filters. */
export interface DailyReportListQuery {
  pageIndex?: number;
  pageSize?: number;
  /** Admin-only — restrict to a specific user (ignored by /myreports). */
  userId?: string;
  /** Inclusive `YYYY-MM-DD`. */
  fromDate?: string;
  /** Inclusive `YYYY-MM-DD`. */
  toDate?: string;
  search?: string;
}
