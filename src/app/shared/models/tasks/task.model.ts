/**
 * Models for the `ManagerTasks/*` and `DeveloperTasks/*` endpoints.
 *
 * Admins get full CRUD over every task; a developer sees only their own tasks
 * and may update just the status + actual hours. Both endpoint families return
 * the same row/detail shape, so a single set of models serves both.
 *
 * Like projects, the API crossed from numeric enum codes to string names: the
 * list/detail reads now return `status` / `priority` / `category` as the enum
 * *name* (`"Review"`, `"Medium"`, `"Design"`) — equal to `*Name` — and
 * create/update/status payloads send the name too. The numeric enums are kept
 * for the badge helpers (tolerant of both) and because the control-panel's
 * `todayDeadlines` still rides on the numeric `ProjectPriorityCode`.
 *
 * Task priority reuses the project priority type (`High` / `Medium` / `Low`).
 */
import {
  ProjectPriorityCode,
  ProjectPriorityName,
} from '../projects/project.model';

/** `StatusOfTask` — numeric codes (legacy; kept for badge tolerance). */
export enum TaskStatusCode {
  ToDo = 1,
  InProgress = 2,
  Review = 3,
  Completed = 4,
}

/** `TaskCategory` — numeric codes (legacy; kept for badge tolerance). */
export enum TaskCategoryCode {
  Development = 1,
  Design = 2,
  Testing = 3,
  Documentation = 4,
  Other = 5,
  Bug = 6,
}

/** String status names the task endpoints now return and accept. */
export type TaskStatusName = 'ToDo' | 'InProgress' | 'Review' | 'Completed';

/** String category names the task endpoints now return and accept. */
export type TaskCategoryName =
  | 'Development'
  | 'Design'
  | 'Testing'
  | 'Documentation'
  | 'Other'
  | 'Bug';

/** Ordered status names driving the status `<select>` (form + filter). */
export const TASK_STATUSES: ReadonlyArray<TaskStatusName> = [
  'ToDo',
  'InProgress',
  'Review',
  'Completed',
];

/** Ordered category names driving the category `<select>`. */
export const TASK_CATEGORIES: ReadonlyArray<TaskCategoryName> = [
  'Development',
  'Design',
  'Testing',
  'Documentation',
  'Other',
  'Bug',
];

/**
 * Bootstrap subtle-badge classes for a task status, tolerant of both the new
 * string name (`"Review"`) and the legacy numeric code (`3`).
 */
export function taskStatusBadgeClass(
  status: TaskStatusName | TaskStatusCode | string | number,
): string {
  switch (status) {
    case TaskStatusCode.ToDo:
    case 'ToDo':
      return 'bg-secondary-subtle text-secondary';
    case TaskStatusCode.InProgress:
    case 'InProgress':
      return 'bg-primary-subtle text-primary';
    case TaskStatusCode.Review:
    case 'Review':
      return 'bg-warning-subtle text-warning';
    case TaskStatusCode.Completed:
    case 'Completed':
      return 'bg-success-subtle text-success';
    default:
      return 'bg-secondary-subtle text-secondary';
  }
}

/**
 * Bootstrap subtle-badge classes for a task category, tolerant of both the new
 * string name (`"Design"`) and the legacy numeric code (`2`).
 */
export function taskCategoryBadgeClass(
  category: TaskCategoryName | TaskCategoryCode | string | number,
): string {
  switch (category) {
    case TaskCategoryCode.Development:
    case 'Development':
      return 'bg-primary-subtle text-primary';
    case TaskCategoryCode.Design:
    case 'Design':
      return 'bg-purple-subtle text-purple';
    case TaskCategoryCode.Testing:
    case 'Testing':
      return 'bg-info-subtle text-info';
    case TaskCategoryCode.Documentation:
    case 'Documentation':
      return 'bg-secondary-subtle text-secondary';
    case TaskCategoryCode.Bug:
    case 'Bug':
      return 'bg-danger-subtle text-danger';
    default:
      return 'bg-secondary-subtle text-secondary';
  }
}

/** Single assignee entry in the task response. */
export interface TaskAssignee {
  userId: string;
  fullName: string;
}

/** A task as returned by the list endpoints and the by-id reads. */
export interface TaskListItem {
  id: number;
  title: string;
  description: string;
  projectId: number;
  projectName: string;
  assignees: TaskAssignee[];
  createdById: string;
  createdByName: string;
  status: TaskStatusName;
  statusName: string;
  priority: ProjectPriorityName;
  priorityName: string;
  category: TaskCategoryName;
  categoryName: string;
  /** ISO date-time. */
  dueDate: string;
  estimatedHours: number;
  actualHours: number | null;
  completedAt: string | null;
  tags: string;
  createdAt: string;
}

/** Detail read is identical to the list row. */
export type TaskDetail = TaskListItem;

/** Body for `POST /ManagerTasks/CreateTask` and `PUT /ManagerTasks/UpdateTask/{id}`. */
export interface CreateTaskRequest {
  title: string;
  description: string;
  projectId: number;
  assignedToIds: string[];
  status: TaskStatusName;
  priority: ProjectPriorityName;
  category: TaskCategoryName;
  /** ISO date-time. */
  dueDate: string;
  estimatedHours: number;
  tags: string;
}

export type UpdateTaskRequest = CreateTaskRequest;

/**
 * Body for `PUT /DeveloperTasks/UpdateMyTaskStatus/{id}`.
 *
 * A developer may only move their task along and log the hours actually spent.
 */
export interface UpdateMyTaskStatusRequest {
  status: TaskStatusName;
  actualHours: number;
}

/** Query params for the paginated + filterable list endpoints. */
export interface TaskListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
  ProjectId?: number;
  Status?: TaskStatusName;
  Priority?: ProjectPriorityName;
}

// ─────────── statistics + control panel ───────────

/** One bar in the weekly-productivity chart. */
export interface WeeklyProductivityPoint {
  day: string;
  completedTasks: number;
}

/** One group in the projects-progress chart. */
export interface ProjectsProgressPoint {
  week: string;
  completed: number;
  inProgress: number;
}

/**
 * Payload of `ManagerTasks/GetStatistics` and `DeveloperTasks/GetMyStatistics`
 * — drives the KPI strip + two charts on the projects board.
 */
export interface TaskStatistics {
  tasksDueToday: number;
  highPriorityTasksDueToday: number;
  overdueProjects: number;
  completedProjectsThisQuarter: number;
  activeProjects: number;
  activeProjectsAddedThisMonth: number;
  weeklyProductivity: WeeklyProductivityPoint[];
  projectsProgress: ProjectsProgressPoint[];
}

/** A single "due today" row in the control panel. */
export interface TodayDeadline {
  taskId: number;
  title: string;
  projectName: string;
  dueDate: string;
  priority: ProjectPriorityCode;
}

/** One group in the sprint-performance chart. */
export interface SprintPerformancePoint {
  sprint: string;
  planned: number;
  completed: number;
}

/**
 * Payload of `ManagerTasks/GetControlPanel` and
 * `DeveloperTasks/GetMyControlPanel` — drives the developer dashboard.
 */
export interface TaskControlPanel {
  deadlinesToday: number;
  completedTasks: number;
  assignedTasks: number;
  activeProjects: number;
  todayDeadlines: TodayDeadline[];
  sprintPerformance: SprintPerformancePoint[];
}
