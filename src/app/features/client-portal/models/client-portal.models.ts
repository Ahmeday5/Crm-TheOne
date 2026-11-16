/**
 * Client portal — what the customer who owns a project sees, and the requests
 * (issues / change requests / questions) they raise about it. Staff answer the
 * same requests from the project workspace.
 *
 * Backend contract: `ClientPortal/*` + `ManagerProjects/{id}/client-requests`
 * (see the backend prompt). Mock-served today via `MockClientPortalGateway`.
 */

export type ClientProjectStatus = 'Planned' | 'InProgress' | 'Completed' | 'OnHold' | 'Cancelled';

export type MilestoneStatus = 'Done' | 'InProgress' | 'Pending';

export interface Milestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  completedAt: string | null;
}

/** A project as the client sees it — nothing internal (no git, no credentials). */
export interface ClientProjectSummary {
  projectId: number;
  name: string;
  status: ClientProjectStatus;
  /** 0–100, computed server-side. */
  progressPercent: number;
  startDate: string;
  expectedEndDate: string;
  lastUpdateAt: string;
  openRequests: number;
}

export interface ClientProjectDetail extends ClientProjectSummary {
  milestones: Milestone[];
}

export type TimelineKind = 'milestone' | 'release' | 'request' | 'update';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  title: string;
  at: string;
}

export type RequestType = 'Issue' | 'ChangeRequest' | 'Question';
export type RequestStatus = 'Open' | 'InReview' | 'InProgress' | 'Resolved' | 'Closed';
export type RequestPriority = 'High' | 'Medium' | 'Low';

export const REQUEST_TYPES: ReadonlyArray<RequestType> = ['Issue', 'ChangeRequest', 'Question'];
export const REQUEST_STATUSES: ReadonlyArray<RequestStatus> = ['Open', 'InReview', 'InProgress', 'Resolved', 'Closed'];
export const REQUEST_PRIORITIES: ReadonlyArray<RequestPriority> = ['High', 'Medium', 'Low'];

export interface RequestAttachment {
  name: string;
  sizeBytes: number;
  /** Server-relative URL; `null` in the preview (nothing is uploaded). */
  url: string | null;
}

export interface ClientRequest {
  id: string;
  projectId: number;
  projectName: string;
  type: RequestType;
  title: string;
  description: string;
  status: RequestStatus;
  /** Set by staff; `null` until triaged. */
  priority: RequestPriority | null;
  attachments: RequestAttachment[];
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
}

export type CommentAuthorRole = 'Client' | 'Staff';

export interface RequestComment {
  id: string;
  requestId: string;
  authorName: string;
  authorRole: CommentAuthorRole;
  body: string;
  attachments: RequestAttachment[];
  createdAt: string;
}

export interface NewRequestDraft {
  projectId: number;
  type: RequestType;
  title: string;
  description: string;
  files: File[];
}

/** Staff-side triage. */
export interface RequestPatch {
  status?: RequestStatus;
  priority?: RequestPriority | null;
}
