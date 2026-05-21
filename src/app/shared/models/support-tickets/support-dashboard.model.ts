/**
 * Models for `GET /Support/Dashboard` — the data behind the support dashboard
 * (route `/appsupport-dashboard`).
 *
 * `ticketsByStatus[].statusId` lines up with the {@link SupportTicketStatus}
 * enum (Open = 0 … Closed = 4), so the UI maps it through
 * `SUPPORT_TICKET_STATUS_MAP` for bilingual labels + the shared badge colors
 * instead of relying on the Arabic-only `statusName` the API returns.
 */

/** One slice of the status-breakdown chart. */
export interface SupportDashboardStatusCount {
  /** Mirrors `SupportTicketStatus` (0 = Open … 4 = Closed). */
  statusId: number;
  /** Arabic label from the backend — kept as a fallback only. */
  statusName: string;
  count: number;
}

/** One point on the trailing-7-days "resolved" trend. */
export interface SupportDashboardWeeklyPoint {
  /** ISO date (midnight UTC). */
  date: string;
  count: number;
}

/** Full payload of `GET /Support/Dashboard`. */
export interface SupportDashboard {
  /** Tickets resolved today, and the team's daily target. */
  resolvedToday: number;
  resolvedTodayTarget: number;
  /** Currently open tickets, and how many of those are high priority. */
  openTickets: number;
  openHighPriority: number;
  /** Customers handed to support that still need attention. */
  assignedCustomers: number;
  /** Critical (highest-severity) tickets needing immediate action. */
  criticalTickets: number;
  ticketsByStatus: SupportDashboardStatusCount[];
  weeklyResolved: SupportDashboardWeeklyPoint[];
}
