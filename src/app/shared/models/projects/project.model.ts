/**
 * Models for the `ManagerProjects/*` and `DeveloperProjects/*` endpoints.
 *
 * The two endpoint families return the exact same row/detail shape — the only
 * difference is scope (all projects vs. the signed-in developer's projects) and
 * which actions the caller may perform (admin can create/update/delete, a
 * developer is read-only). So a single set of models serves both.
 */

/**
 * Status / priority crossed from numeric codes to string names.
 *
 * The API used to serialize `status` / `priority` as the numeric enum value
 * (1, 2, …) and carry the label separately in `statusName` / `priorityName`.
 * It now serializes — and accepts on create/update — the enum *name* directly
 * (`"Planned"`, `"High"`), so `status === statusName` and
 * `priority === priorityName`.
 *
 * The numeric enums below are kept on purpose: the tasks feature still rides on
 * `ProjectPriorityCode` (see `task.model.ts`), some endpoints (e.g. task
 * filters, dashboard deadlines) still speak numbers, and the badge helpers stay
 * tolerant of both forms so a mixed payload never falls back to a grey pill.
 */
export enum ProjectStatusCode {
  Planned = 1,
  InProgress = 2,
  Completed = 3,
  OnHold = 4,
  Cancelled = 5,
}

/** `PriorityStatus` — numeric codes (1 → High, per the sample payloads). */
export enum ProjectPriorityCode {
  High = 1,
  Medium = 2,
  Low = 3,
}

/** String status names the project endpoints now return and accept. */
export type ProjectStatusName =
  | 'Planned'
  | 'InProgress'
  | 'Completed'
  | 'OnHold'
  | 'Cancelled';

/** String priority names the project endpoints now return and accept. */
export type ProjectPriorityName = 'High' | 'Medium' | 'Low';

/** Ordered status names driving the status `<select>` in the add/edit form. */
export const PROJECT_STATUSES: ReadonlyArray<ProjectStatusName> = [
  'Planned',
  'InProgress',
  'Completed',
  'OnHold',
  'Cancelled',
];

/**
 * Ordered priority names driving the priority `<select>` in the project
 * add/edit form (string names, matching the new request contract).
 */
export const PROJECT_PRIORITY_OPTIONS: ReadonlyArray<ProjectPriorityName> = [
  'High',
  'Medium',
  'Low',
];

/**
 * Ordered priority *codes* — still consumed by the tasks feature, whose
 * priority filter and payload remain numeric (`ProjectPriorityCode`).
 */
export const PROJECT_PRIORITIES: ReadonlyArray<ProjectPriorityCode> = [
  ProjectPriorityCode.High,
  ProjectPriorityCode.Medium,
  ProjectPriorityCode.Low,
];

/**
 * Bootstrap subtle-badge classes for a project status, tolerant of both the
 * new string name (`"Planned"`) and the legacy numeric code (`1`).
 */
export function projectStatusBadgeClass(
  status: ProjectStatusName | ProjectStatusCode | string | number,
): string {
  switch (status) {
    case ProjectStatusCode.Planned:
    case 'Planned':
      return 'bg-secondary-subtle text-secondary';
    case ProjectStatusCode.InProgress:
    case 'InProgress':
      return 'bg-primary-subtle text-primary';
    case ProjectStatusCode.Completed:
    case 'Completed':
      return 'bg-success-subtle text-success';
    case ProjectStatusCode.OnHold:
    case 'OnHold':
      return 'bg-warning-subtle text-warning';
    case ProjectStatusCode.Cancelled:
    case 'Cancelled':
      return 'bg-danger-subtle text-danger';
    default:
      return 'bg-secondary-subtle text-secondary';
  }
}

/**
 * Bootstrap subtle-badge classes for a priority, tolerant of both the new
 * string name (`"High"`) and the legacy numeric code (`1`). Tasks still pass
 * numbers, so both forms must resolve.
 */
export function projectPriorityBadgeClass(
  priority: ProjectPriorityName | ProjectPriorityCode | string | number,
): string {
  switch (priority) {
    case ProjectPriorityCode.High:
    case 'High':
      return 'bg-danger-subtle text-danger';
    case ProjectPriorityCode.Medium:
    case 'Medium':
      return 'bg-warning-subtle text-warning';
    case ProjectPriorityCode.Low:
    case 'Low':
      return 'bg-info-subtle text-info';
    default:
      return 'bg-secondary-subtle text-secondary';
  }
}

/** One engineer assigned to a project (subset of the developer record). */
export interface ProjectEngineerRef {
  engineerId: string;
  fullName: string;
}

/**
 * A project as returned by the list endpoints
 * (`ManagerProjects/GetProjects`, `GetActiveProjects`,
 * `DeveloperProjects/GetMyProjects`, `GetMyActiveProjects`) and the
 * by-id reads. List rows and detail reads share this shape.
 */
export interface ProjectListItem {
  id: number;
  title: string;
  description: string;
  customerId: number;
  customerName: string;
  companyName: string | null;
  projectManagerId: string | null;
  projectManagerName: string | null;
  createdById: string;
  createdByName: string;
  status: ProjectStatusName;
  statusName: string;
  priority: ProjectPriorityName;
  priorityName: string;
  price: number;
  /** ISO date-time. */
  start: string;
  /** ISO date-time. */
  end: string;
  progress: number;
  engineers: ProjectEngineerRef[];
  teamMembersCount: number;
  createdAt: string;
}

/** Detail read is identical to the list row. */
export type ProjectDetail = ProjectListItem;

/**
 * Body for `POST /ManagerProjects/CreateProject`.
 *
 * `projectManagerId` is intentionally omitted — the backend resolves the
 * manager from the JWT, so we never send it.
 */
export interface CreateProjectRequest {
  title: string;
  description: string;
  customerId: number;
  status: ProjectStatusName;
  priority: ProjectPriorityName;
  price: number;
  /** ISO date-time. */
  start: string;
  /** ISO date-time. */
  end: string;
  engineerIds: string[];
}

/**
 * Body for `PUT /ManagerProjects/UpdateProject/{id}`.
 *
 * The customer can't be reassigned on edit — same field set as create minus
 * the (already-omitted) manager. `customerId` stays so the backend keeps the
 * link, mirroring the sample payload.
 */
export interface UpdateProjectRequest {
  title: string;
  description: string;
  customerId: number;
  status: ProjectStatusName;
  priority: ProjectPriorityName;
  price: number;
  /** ISO date-time. */
  start: string;
  /** ISO date-time. */
  end: string;
  engineerIds: string[];
}

/** Query params for the paginated list endpoints. */
export interface ProjectListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
}

/**
 * Developer record returned by `GET /Auth/developers` — the source for the
 * engineers multi-select on the add/edit form.
 */
export interface DeveloperOption {
  userId: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  address: string | null;
  specialty: string | null;
}
