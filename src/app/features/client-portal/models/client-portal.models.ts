/**
 * Client portal (`ClientPortal/*`, role `Client`) and the client requests both
 * sides share (`ManagerProjects/{id}/client-requests` for staff). Backend
 * changes of 2026-11-16 — enums travel as their string names.
 */
import { ProjectStatusName } from '../../../shared/models';
import { TimelineEvent } from '../../project-workspace/models/workspace.models';

export type { TimelineEvent };

// ─────────── projects ───────────

export interface ClientProject {
  projectId: number;
  name: string;
  status: ProjectStatusName;
  /** 0–100, computed server-side — display as is. */
  progressPercent: number;
  startDate: string;
  expectedEndDate: string;
  lastUpdateAt: string;
}

export type ClientMilestoneStatus = 'Done' | 'InProgress' | 'Pending';

export interface ClientMilestone {
  id: number;
  title: string;
  status: ClientMilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
}

export interface ClientProjectDetails extends ClientProject {
  description: string | null;
  milestones: ClientMilestone[];
}

// ─────────── requests ───────────

export type RequestType = 'Issue' | 'ChangeRequest' | 'Question';
export type RequestStatus = 'Open' | 'InReview' | 'InProgress' | 'Resolved' | 'Closed';
export type RequestPriority = 'High' | 'Medium' | 'Low';

export const REQUEST_TYPES: ReadonlyArray<RequestType> = ['Issue', 'ChangeRequest', 'Question'];
export const REQUEST_STATUSES: ReadonlyArray<RequestStatus> = ['Open', 'InReview', 'InProgress', 'Resolved', 'Closed'];
export const REQUEST_PRIORITIES: ReadonlyArray<RequestPriority> = ['High', 'Medium', 'Low'];

export interface RequestAttachment {
  id: number;
  /** Server-relative — resolve with `resolveAssetUrl`. */
  fileUrl: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
}

export interface ClientRequestListItem {
  id: number;
  projectId: number;
  projectName: string | null;
  type: RequestType;
  title: string;
  status: RequestStatus;
  priority: RequestPriority | null;
  clientName: string | null;
  /** Always `null` in the client portal. */
  assignedToId: string | null;
  assignedToName: string | null;
  commentsCount: number;
  attachmentsCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export type CommentAuthorRole = 'Client' | 'Admin' | 'Developer';

export interface ClientRequestComment {
  id: number;
  authorName: string | null;
  authorRole: CommentAuthorRole;
  isMine: boolean;
  body: string;
  attachments: RequestAttachment[];
  createdAt: string;
}

export interface ClientRequestDetails extends ClientRequestListItem {
  description: string;
  resolvedAt: string | null;
  attachments: RequestAttachment[];
  /** Oldest first. */
  comments: ClientRequestComment[];
}

export interface RequestListQuery {
  status?: RequestStatus | null;
  type?: RequestType | null;
  pageIndex?: number;
  pageSize?: number;
}

export interface NewRequestInput {
  type: RequestType;
  title: string;
  description: string;
  attachments: File[];
}

/** Staff triage — any field left out is unchanged; `assignedToId: ''` unassigns. */
export interface RequestPatch {
  status?: RequestStatus;
  priority?: RequestPriority;
  assignedToId?: string;
}

// ─────────── upload rules (mirror the backend) ───────────

export const REQUEST_MAX_FILES = 10;
export const REQUEST_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const REQUEST_TITLE_MAX = 200;
export const REQUEST_TEXT_MAX = 5000;

const ALLOWED_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
  'zip', 'rar', '7z',
  'mp4', 'mov', 'webm', 'mp3', 'm4a', 'ogg',
]);

export const REQUEST_ACCEPT = [...ALLOWED_EXT].map((e) => `.${e}`).join(',');

export type AttachmentProblem = 'type' | 'size' | 'empty';

export function checkRequestFile(file: Pick<File, 'name' | 'size'>): AttachmentProblem | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.has(ext)) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > REQUEST_MAX_FILE_BYTES) return 'size';
  return null;
}

export function isImageAttachment(a: { contentType: string | null; fileName: string }): boolean {
  return (a.contentType ?? '').startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(a.fileName);
}

export function isRequestOpen(status: RequestStatus): boolean {
  return status !== 'Resolved' && status !== 'Closed';
}
