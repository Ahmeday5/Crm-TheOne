/**
 * Models for the `ResourceManagement/*` endpoints behind the
 * "Resource management & workload" board.
 *
 *   - `TeamWorkload`        → KPI strip + per-developer overview (filterable).
 *   - `WorkloadDistribution` → the horizontal "who carries what" bars.
 */
import { ProjectPriorityName } from '../projects/project.model';

/** One developer row in the team-workload overview. */
export interface DeveloperWorkload {
  developerId: string;
  fullName: string;
  specialty: string | null;
  tasksCount: number;
  usedHours: number;
  availableHours: number;
  capacityHours: number;
  /** 0–100. */
  workloadPercent: number;
}

/** Payload of `GET /ResourceManagement/TeamWorkload` (the unwrapped `data`). */
export interface TeamWorkload {
  availableDevelopers: number;
  overloadedDevelopers: number;
  /** Average workload across the team, 0–100. */
  averageWorkload: number;
  totalDevelopers: number;
  developers: DeveloperWorkload[];
}

/** One bar in `GET /ResourceManagement/WorkloadDistribution`. */
export interface WorkloadDistributionItem {
  developerId: string;
  fullName: string;
  tasksCount: number;
  /** 0–100. */
  workloadPercent: number;
}

/** Sort options accepted by the team-workload endpoint. */
export type WorkloadSort =
  | 'WorkloadDesc'
  | 'WorkloadAsc'
  | 'TasksDesc'
  | 'NameAsc';

/** Ordered list driving the "sort by" `<select>`. */
export const WORKLOAD_SORTS: ReadonlyArray<WorkloadSort> = [
  'WorkloadDesc',
  'WorkloadAsc',
  'TasksDesc',
  'NameAsc',
];

/** Query params for `GET /ResourceManagement/TeamWorkload`. */
export interface TeamWorkloadQuery {
  Search?: string;
  ProjectId?: number;
  Priority?: ProjectPriorityName;
  Sort?: WorkloadSort;
}
