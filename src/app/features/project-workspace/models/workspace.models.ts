/**
 * Project workspace — the one screen an admin runs a project from
 * (`ManagerProjects/{projectId}/*`; contract v2 of 2026-11-17).
 * Enums travel as their string names.
 */

// ─────────── team + allocation ───────────

export interface ProjectDeveloper {
  developerId: string;
  developerName: string | null;
  developerImageUrl: string | null;
  /** 0–100; the team's total is ≤ 100. */
  allocationPercent: number;
  /** Free text: Lead / Backend / Frontend / Mobile / QA … */
  roleOnProject: string | null;
  assignedAt: string;
  tasksTotal: number;
  tasksDone: number;
}

/** One row of `PUT …/developers` (the whole list is replaced). */
export interface ProjectDeveloperInput {
  developerId: string;
  allocationPercent: number;
  roleOnProject: string | null;
}

export const PROJECT_ROLE_SUGGESTIONS: ReadonlyArray<string> = ['Lead', 'Backend', 'Frontend', 'Mobile', 'QA', 'UI/UX'];

export function totalAllocation(rows: ReadonlyArray<{ allocationPercent: number }>): number {
  return rows.reduce((sum, r) => sum + (Number(r.allocationPercent) || 0), 0);
}

// ─────────── milestones ───────────

export type MilestoneStatus = 'Pending' | 'InProgress' | 'Done';
export const MILESTONE_STATUSES: ReadonlyArray<MilestoneStatus> = ['Pending', 'InProgress', 'Done'];

export interface Milestone {
  id: number;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  orderIndex: number;
  /** Audit (contract v2) — optional until the backend ships them. */
  createdByName?: string | null;
  updatedByName?: string | null;
  updatedAt?: string | null;
}

export interface MilestoneInput {
  title: string;
  description?: string | null;
  status?: MilestoneStatus;
  dueDate?: string | null;
  orderIndex?: number;
}

// ─────────── timeline ───────────

export type TimelineEventType =
  | 'MilestoneCompleted'
  | 'MilestoneAdded'
  | 'MilestoneStatusChanged'
  | 'ReleasePublished'
  | 'CredentialAdded'
  | 'CredentialUpdated'
  | 'StatusChanged'
  | 'RequestCreated'
  | 'RequestStatusChanged';

export interface TimelineEvent {
  id: number;
  type: TimelineEventType;
  title: string;
  description: string | null;
  createdAt: string;
  /** Admin only — `null` in the client portal. */
  isClientVisible: boolean | null;
}
