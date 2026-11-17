/**
 * Client portal v2 (`ClientPortal/*`, opened from a private magic link) and
 * the client requests both sides share (`ManagerProjects/{id}/client-requests`
 * for staff). Contract: `backend-prompt-client-portal-v2.md` — enums travel as
 * their string names.
 */
import { ProjectStatusName } from '../../../shared/models';
import { TimelineEvent } from '../../project-workspace/models/workspace.models';

export type { TimelineEvent };

// ─────────── projects ───────────

/** Where `progressPercent` comes from: the team's earned shares, the milestones, or nothing yet. */
export type ProgressSource = 'Team' | 'Milestones' | 'None';
/** Progress vs. the linear plan by working days (server-computed). */
export type ScheduleHealth = 'OnTrack' | 'AtRisk' | 'Delayed' | 'Completed';

export interface ClientNextMilestone {
  title: string;
  dueDate: string | null;
}

export interface ClientLatestRelease {
  platform: ReleasePlatform;
  versionName: string;
  createdAt: string;
}

/** One card on the portal home (`GET ClientPortal/MyProjects`). */
export interface ClientProject {
  projectId: number;
  name: string;
  shortDescription: string | null;
  status: ProjectStatusName;
  /** 0–100, computed server-side — the SAME number staff see. */
  progressPercent: number;
  progressSource: ProgressSource;
  startDate: string;
  expectedEndDate: string;
  /** Calendar days until `expectedEndDate` (negative when overdue). */
  daysRemaining: number;
  scheduleHealth: ScheduleHealth;
  nextMilestone: ClientNextMilestone | null;
  latestRelease: ClientLatestRelease | null;
  openRequestsCount: number;
  lastUpdateAt: string;
}

export type ClientMilestoneStatus = 'Done' | 'InProgress' | 'Pending';

export interface ClientMilestone {
  id: number;
  title: string;
  description: string | null;
  status: ClientMilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  orderIndex: number;
}

/** Only when the project shares its team — names/roles, never percentages. */
export interface ClientTeamMember {
  name: string;
  roleOnProject: string | null;
  avatarUrl: string | null;
}

export interface ClientProjectManager {
  name: string;
  avatarUrl: string | null;
  whatsApp: string | null;
}

export interface ClientProjectCounts {
  releases: number;
  credentials: number;
  openRequests: number;
  resolvedRequests: number;
}

/** `GET ClientPortal/Projects/{id}`. */
export interface ClientProjectDetails extends ClientProject {
  description: string | null;
  milestones: ClientMilestone[];
  /** `null` when the project hides its team from the client. */
  team: ClientTeamMember[] | null;
  counts: ClientProjectCounts;
  projectManager: ClientProjectManager | null;
}

export type ProgressRange = '30d' | '90d' | 'all';

/** `GET ClientPortal/Projects/{id}/progress-history` — one point per day with a change, plus today. */
export interface ProgressPoint {
  /** `yyyy-MM-dd` */
  date: string;
  percent: number;
}

// ─────────── portal identity ───────────

export type SocialKind = 'Facebook' | 'Instagram' | 'LinkedIn' | 'X' | 'YouTube' | 'TikTok' | 'Website';

/** `GET ClientPortal/branding` (anonymous). Every field may be empty — the UI falls back. */
export interface PortalBranding {
  companyName: string;
  tagline: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  /** Square mark for the intro animation / favicon-sized spots. */
  logoMarkUrl: string | null;
  primaryColor: string | null;
  website: string | null;
  supportPhone: string | null;
  supportWhatsApp: string | null;
  supportEmail: string | null;
  workingHours: string | null;
  socials: { kind: SocialKind; url: string }[];
}

export interface PortalCustomer {
  id: number;
  name: string;
  companyName: string | null;
  logoUrl: string | null;
}

/** `GET ClientPortal/me`. */
export interface PortalMe {
  customer: PortalCustomer;
  visitorName: string | null;
  link: { label: string | null; expiresAt: string | null };
  projectsCount: number;
}

// ─────────── deliverables (client view) ───────────

export type CredentialKind = 'WebDashboard' | 'Website' | 'AdminPanel' | 'Api' | 'Other';
export type CredentialEnvironment = 'Production' | 'Staging' | 'Demo';

/** A system the client can open and try. The password is fetched on demand (`reveal`). */
export interface ClientCredential {
  id: number;
  title: string;
  kind: CredentialKind;
  environment: CredentialEnvironment;
  url: string;
  username: string | null;
  hasPassword: boolean;
  notes: string | null;
  orderIndex: number;
  updatedAt: string | null;
}

export type ReleasePlatform = 'Android' | 'iOS' | 'Web' | 'Desktop' | 'Other';
export type ReleaseStage = 'Internal' | 'Beta' | 'ReleaseCandidate' | 'Production';

/** An app version the client can download / open. Uploader names are never sent to the client. */
export interface ClientRelease {
  id: number;
  platform: ReleasePlatform;
  versionName: string;
  buildNumber: number;
  stage: ReleaseStage;
  releaseNotes: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  /** TestFlight / store testing / web preview link (when there is no file). */
  externalUrl: string | null;
  hasFile: boolean;
  /** Newest visible release of its platform. */
  isLatest: boolean;
  createdAt: string;
}

/** `POST …/releases/{id}/download-link` — usable without a session (QR on a phone). */
export interface DownloadLink {
  url: string;
  expiresAt: string;
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
