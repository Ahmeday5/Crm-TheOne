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
  // ── contract v2 (optional until the backend ships them) ──
  /** How much of THEIR OWN share is done, 0–100. */
  shareCompletionPercent?: number;
  /** Share % per remaining working day to finish on time. */
  suggestedDailyStep?: number;
  /** Where the share should be today on a linear plan. */
  expectedShareCompletionToday?: number;
  paceStatus?: PaceStatus;
  /** The project's overall progress (same number as everywhere). */
  projectProgressPercent?: number;
  lastReportAt?: string | null;
  // ── contract v2 names (`GET {pid}/my-progress`, `GET {pid}/team`) ──
  responsibilityPercent?: number;
  earnedProjectPercent?: number;
  earnedPercent?: number;
  remainingSharePercent?: number;
  workingDays?: number;
  elapsedWorkingDays?: number;
  remainingWorkingDays?: number;
}

/**
 * The backend renamed the progress fields in contract v2
 * (`responsibilityPercent`, `earnedProjectPercent` / `earnedPercent`…).
 * Everything in the app reads the original names, so every response is
 * normalised here once: v2 name first, legacy name as the fallback.
 */
export function normalizeTeamMember(raw: ProjectTeamMemberResponseDto): ProjectTeamMemberResponseDto {
  const num = (...values: Array<number | null | undefined>): number => {
    for (const v of values) if (v != null && Number.isFinite(Number(v))) return Number(v);
    return 0;
  };
  const responsibility = num(raw.responsibilityPercent, raw.responsibilityPercentage);
  const earned = num(raw.earnedProjectPercent, raw.earnedPercent, raw.earnedProgressPercentage);
  return {
    ...raw,
    responsibilityPercentage: responsibility,
    earnedProgressPercentage: earned,
    remainingResponsibilityPercentage: num(raw.remainingResponsibilityPercentage, Math.max(0, responsibility - earned)),
    dailyAllocation: num(raw.dailyAllocation),
    hasReportedToday: !!raw.hasReportedToday,
  };
}

export type PaceStatus = 'Ahead' | 'OnTrack' | 'Behind';

/**
 * Share completion (0–100) for a member: the v2 field, else derived from
 * earned / responsibility (both are % of the project today).
 */
export function shareCompletionOf(m: Pick<ProjectTeamMemberResponseDto, 'shareCompletionPercent' | 'earnedProgressPercentage' | 'responsibilityPercentage'>): number {
  if (m.shareCompletionPercent != null) return clamp100(m.shareCompletionPercent);
  if (!m.responsibilityPercentage) return 0;
  return clamp100((m.earnedProgressPercentage / m.responsibilityPercentage) * 100);
}

/**
 * Project points a report adds: moving your share from `from`% to `to`%
 * with a `responsibility`% share. 33% share, 0 → 50 ⇒ 16.5.
 */
export function projectContribution(responsibility: number, from: number, to: number): number {
  return Math.round(((Math.max(0, to - from) * responsibility) / 100) * 100) / 100;
}

function clamp100(v: number): number {
  return Math.round(Math.max(0, Math.min(100, Number(v) || 0)) * 100) / 100;
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
  /** Contract v2: cumulative % of the developer's own share (0–100, ≥ current). */
  shareCompletionPercent?: number;
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
  /** Contract v2. */
  shareCompletionBefore?: number;
  shareCompletionAfter?: number;
  responsibilityPercentAtTime?: number;
  appliedProjectContribution?: number;
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
