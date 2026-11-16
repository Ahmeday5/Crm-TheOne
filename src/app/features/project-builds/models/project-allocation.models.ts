/**
 * Per-developer allocation on a project — the admin gives each engineer a share
 * (percent) of the work/reward, and tracks their task progress, all from the
 * one project screen.
 *
 * Backend contract: `ManagerProjects/{projectId}/developers` (see the backend
 * prompt). Mock-served today via `MockProjectBuildsGateway`.
 */

/** One developer's allocation + live task counters on a project. */
export interface ProjectDeveloper {
  developerId: string;
  developerName: string;
  developerImageUrl: string | null;
  /** 0–100; the team's shares sum to ≤ 100. */
  allocationPercent: number;
  roleOnProject: string | null;
  tasksTotal: number;
  tasksDone: number;
  assignedAt: string;
}

/** One row the admin edits when (re)allocating the team. */
export interface AllocationDraft {
  developerId: string;
  developerName: string;
  developerImageUrl: string | null;
  allocationPercent: number;
  roleOnProject: string;
}

/** Sum of a draft list's shares — the UI blocks a save over 100. */
export function totalAllocation(rows: ReadonlyArray<{ allocationPercent: number }>): number {
  return rows.reduce((sum, r) => sum + (Number(r.allocationPercent) || 0), 0);
}
