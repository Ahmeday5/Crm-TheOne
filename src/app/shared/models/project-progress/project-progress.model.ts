/**
 * Domain types for the `ProjectProgress/*` endpoints — per-project team
 * responsibility split, earned progress tracking, and developer daily
 * reports.
 *
 * Working days are Sunday–Thursday (Friday + Saturday are off) — see
 * `isWorkingDay` / `WEEKEND_DAYS` below, used to gate the report-date picker.
 */

// ─────────── Team assignment ───────────

export interface AssignTeamMemberDto {
  developerId: string;
  projectRole?: string;
  /** Must sum to exactly 100 across all members of a project. */
  responsibilityPercentage: number;
}

export interface AssignProjectTeamDto {
  members: AssignTeamMemberDto[];
}

export interface ProjectTeamMemberResponseDto {
  developerId: string;
  developerName?: string;
  projectRole?: string;
  responsibilityPercentage: number;
  earnedProgressPercentage: number;
  remainingResponsibilityPercentage: number;
  dailyAllocation: number;
  hasReportedToday: boolean;
}

// ─────────── Progress summary ───────────

export interface ProjectProgressSummaryDto {
  projectId: number;
  projectTitle: string;
  overallProgressPercentage: number;
  workingDays: number;
  elapsedWorkingDays: number;
  remainingWorkingDays: number;
  teamMembers: ProjectTeamMemberResponseDto[];
}

// ─────────── Progress adjustment ───────────

export interface AdjustProgressDto {
  newProgressPercentage: number;
  reason?: string;
}

export interface ProjectProgressHistoryDto {
  id: number;
  projectId: number;
  developerId: string;
  developerName?: string;
  adjustedById: string;
  adjustedByName?: string;
  oldProgress: number;
  newProgress: number;
  reason?: string;
  adjustedAt: string;
}

// ─────────── Daily reports ───────────

export interface CreateProjectDailyReportDto {
  projectId: number;
  /** `yyyy-MM-dd` */
  reportDate: string;
  completedWork: string;
  remainingWork?: string;
  blockers?: string;
  notes?: string;
  /** `null`/omitted ⇒ system applies the developer's auto daily allocation. */
  actualProgressContribution?: number | null;
}

export interface UpdateProjectDailyReportDto {
  completedWork: string;
  remainingWork?: string;
  blockers?: string;
  notes?: string;
  actualProgressContribution?: number | null;
}

export interface ProjectDailyReportResponseDto {
  id: number;
  projectId: number;
  projectTitle: string;
  developerId: string;
  developerName?: string;
  reportDate: string;
  completedWork: string;
  remainingWork?: string;
  blockers?: string;
  notes?: string;
  actualProgressContribution?: number;
  appliedProgressContribution: number;
  attachmentUrls: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectDailyReportListDto {
  id: number;
  projectId: number;
  projectTitle: string;
  developerId: string;
  developerName?: string;
  reportDate: string;
  completedWorkPreview: string;
  appliedProgressContribution: number;
  attachmentsCount: number;
  createdAt: string;
}

export interface ProjectDailyReportParams {
  pageIndex?: number;
  pageSize?: number;
  /** Inclusive `yyyy-MM-dd`. */
  from?: string;
  /** Inclusive `yyyy-MM-dd`. */
  to?: string;
  /** Admin-only filter — ignored by the "my reports" endpoint. */
  developerId?: string;
}

// ─────────── Working-day helpers ───────────

/** `Date.getDay()` values that are non-working (Friday, Saturday). */
export const WEEKEND_DAYS: ReadonlyArray<number> = [5, 6];

export function isWorkingDay(date: Date): boolean {
  return !WEEKEND_DAYS.includes(date.getDay());
}

/** Parses a `yyyy-MM-dd` string as a local date (avoids UTC off-by-one). */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
