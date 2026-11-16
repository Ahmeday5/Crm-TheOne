/**
 * Project workspace — the one screen an admin runs a project from
 * (`ManagerProjects/{projectId}/*`, backend changes of 2026-11-16).
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
  | 'BuildReleased'
  | 'StatusChanged'
  | 'RequestCreated'
  | 'RequestStatusChanged'
  | 'MilestoneAdded';

export interface TimelineEvent {
  id: number;
  type: TimelineEventType;
  title: string;
  description: string | null;
  createdAt: string;
  /** Admin only — `null` in the client portal. */
  isClientVisible: boolean | null;
}

// ─────────── client access ───────────

export interface ClientAccessStatus {
  hasAccess: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  customerId: number;
  customerName: string | null;
}

export interface ClientAccessInput {
  customerId?: number | null;
  email: string;
  fullName?: string | null;
  password?: string | null;
  sendInvite?: boolean;
}

export interface ClientAccessResult {
  userId: string;
  email: string;
  fullName: string | null;
  customerId: number;
  customerName: string | null;
  isNewAccount: boolean;
  /** Returned ONCE, only when the server generated it. Never stored. */
  temporaryPassword: string | null;
  inviteSent: boolean;
}

// ─────────── GitHub ───────────

export interface GitSettings {
  gitHubRepoUrl: string | null;
  /** Default "main". */
  gitBranch: string;
  showBuildsToClient: boolean;
  /** The org GitHub token exists on the server (it is never sent to us). */
  isOrgTokenConfigured: boolean;
}

export interface GitSettingsInput {
  /** `""` unlinks. */
  gitHubRepoUrl: string;
  gitBranch?: string | null;
  showBuildsToClient: boolean;
}

/** `https://github.com/{owner}/{repo}` (optional `.git`). */
export const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?\/?$/;

// ─────────── builds ───────────

export type BuildPlatform = 'Android' | 'iOS' | 'Web' | 'Backend' | 'Other';
export type BuildStatus = 'Pending' | 'Uploading' | 'Pushed' | 'Failed';

export const BUILD_PLATFORMS: ReadonlyArray<BuildPlatform> = ['Android', 'iOS', 'Web', 'Backend', 'Other'];

export interface ProjectBuild {
  id: number;
  projectId: number;
  versionName: string;
  buildNumber: number;
  platform: BuildPlatform;
  developerId: string | null;
  developerName: string | null;
  artifactUrl: string | null;
  artifactFileName: string | null;
  artifactSizeBytes: number | null;
  status: BuildStatus;
  errorMessage: string | null;
  gitRepoUrl: string | null;
  gitBranch: string | null;
  gitTag: string | null;
  gitCommitSha: string | null;
  /** Source still waiting on the server (true until pushed). */
  hasSourceArchive: boolean;
  notes: string | null;
  createdAt: string;
  pushedAt: string | null;
}

export interface BuildListQuery {
  pageIndex?: number;
  pageSize?: number;
  platform?: BuildPlatform | null;
  status?: BuildStatus | null;
}

/** How the source reaches GitHub: the server pushes a zip, or the developer already pushed. */
export type BuildSourceMode = 'archive' | 'commit';

export interface NewBuildInput {
  versionName: string;
  platform: BuildPlatform;
  notes: string;
  artifact: File | null;
  source: { mode: 'archive'; file: File } | { mode: 'commit'; sha: string };
}

export const BUILD_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,50}$/;
export const COMMIT_SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;

export function isBuildInFlight(status: BuildStatus): boolean {
  return status === 'Pending' || status === 'Uploading';
}
