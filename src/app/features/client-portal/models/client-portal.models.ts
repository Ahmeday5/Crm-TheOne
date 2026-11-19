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
  /** Requests waiting for the client's answer (`NeedsClarification`) — "مطلوب ردك". */
  awaitingClientCount: number;
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
  awaitingClient: number;
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
// Contract: `docs/backend-prompt-client-requests-triage.md` (v3 — target + Admin triage gate).

export type RequestType = 'Issue' | 'ChangeRequest' | 'Question';
/**
 * `PendingReview` ⇄ `NeedsClarification` → `Open` (approved) → team flow,
 * or `Rejected`. The triage statuses are never visible to developers.
 */
export type RequestStatus =
  | 'PendingReview'
  | 'NeedsClarification'
  | 'Open'
  | 'InReview'
  | 'InProgress'
  | 'Resolved'
  | 'Closed'
  | 'Rejected';
export type RequestPriority = 'High' | 'Medium' | 'Low';

/** What the request is about. */
export type RequestTarget = 'Website' | 'Dashboard' | 'MobileApp' | 'Other';
/** Which app, when `target = MobileApp` (one project may ship several). */
export type AppAudience = 'Customer' | 'Driver' | 'Vendor' | 'Staff' | 'Other';
export type AppPlatform = 'Android' | 'iOS' | 'Both' | 'Unknown';
export type RequestCommentKind =
  | 'Message'
  | 'ClarificationQuestion'
  | 'ClarificationAnswer'
  | 'InternalNote'
  | 'StatusChange';
export type RejectReasonCode = 'Duplicate' | 'OutOfScope' | 'NeedsNewQuote' | 'NotReproducible' | 'Other';
/** Server-computed: whose move it is. */
export type AwaitingParty = 'Admin' | 'Client' | 'Team';

export const REQUEST_TYPES: ReadonlyArray<RequestType> = ['Issue', 'ChangeRequest', 'Question'];
export const REQUEST_STATUSES: ReadonlyArray<RequestStatus> = [
  'PendingReview',
  'NeedsClarification',
  'Open',
  'InReview',
  'InProgress',
  'Resolved',
  'Closed',
  'Rejected',
];
/** The backend's name for the same enum (`ClientRequestStatus`) — values are identical strings. */
export type ClientRequestStatus = RequestStatus;

/** Approved — the team's flow, IN ORDER (the only statuses developers ever see). */
export const TEAM_STATUSES: ReadonlyArray<RequestStatus> = ['Open', 'InReview', 'InProgress', 'Resolved', 'Closed'];
/** The Admin-only gate before the team. */
export const TRIAGE_STATUSES: ReadonlyArray<RequestStatus> = ['PendingReview', 'NeedsClarification', 'Rejected'];
export const REQUEST_PRIORITIES: ReadonlyArray<RequestPriority> = ['High', 'Medium', 'Low'];
export const REQUEST_TARGETS: ReadonlyArray<RequestTarget> = ['Website', 'Dashboard', 'MobileApp', 'Other'];
export const APP_AUDIENCES: ReadonlyArray<AppAudience> = ['Customer', 'Driver', 'Vendor', 'Staff', 'Other'];
export const APP_PLATFORMS: ReadonlyArray<AppPlatform> = ['Android', 'iOS', 'Both', 'Unknown'];
export const REJECT_REASON_CODES: ReadonlyArray<RejectReasonCode> = [
  'Duplicate',
  'OutOfScope',
  'NeedsNewQuote',
  'NotReproducible',
  'Other',
];

export const APP_NAME_MAX = 100;
export const REJECT_REASON_MAX = 1000;
export const SURFACE_NAME_MAX = 100;

export interface RequestAttachment {
  id: number;
  /** Server-relative — resolve with `resolveAssetUrl`. */
  fileUrl: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
}

/** A part of the project the customer can point at ("تطبيق المندوب", "لوحة التحكم"…). */
export interface ProjectSurface {
  id: number;
  /** Never `Other`. */
  kind: RequestTarget;
  appAudience: AppAudience | null;
  name: string;
  platforms: AppPlatform | null;
  url: string | null;
  orderIndex: number;
  isActive: boolean;
}

/** `GET ClientPortal/Projects/{id}/request-options`. Empty `surfaces` = generic picker. */
export interface RequestOptions {
  surfaces: ProjectSurface[];
  /** ≥ 2 active app surfaces — a specific app must be picked. */
  appRequired: boolean;
}

/** What the customer pointed at — shared by create, display and the Admin's correction. */
export interface RequestTargetFields {
  target: RequestTarget;
  surfaceId: number | null;
  appAudience: AppAudience | null;
  appName: string | null;
  appPlatform: AppPlatform | null;
}

export interface ClientRequestListItem extends RequestTargetFields {
  id: number;
  projectId: number;
  projectName: string | null;
  type: RequestType;
  title: string;
  status: RequestStatus;
  priority: RequestPriority | null;
  /** The portal visitor's name. */
  clientName: string | null;
  customerId: number | null;
  customerName: string | null;
  /** Server snapshot for display (surface / app name) — else the enums are localized. */
  targetLabel: string | null;
  awaitingParty: AwaitingParty | null;
  /** The client wrote while the request was in triage. */
  clientRepliedAt: string | null;
  reviewedAt: string | null;
  rejectReasonCode: RejectReasonCode | null;
  rejectReason: string | null;
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
  kind: RequestCommentKind;
  /** `null` for staff authors of `StatusChange` entries in the portal. */
  authorName: string | null;
  authorRole: CommentAuthorRole;
  isMine: boolean;
  body: string;
  attachments: RequestAttachment[];
  /** Only for `StatusChange`. */
  statusFrom: RequestStatus | null;
  statusTo: RequestStatus | null;
  createdAt: string;
}

export interface ClientRequestDetails extends ClientRequestListItem {
  description: string;
  resolvedAt: string | null;
  /** Staff only — always `null` in the portal. */
  reviewedByName: string | null;
  approvedAt: string | null;
  clarificationRequestedAt: string | null;
  surface: ProjectSurface | null;
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

export interface NewRequestInput extends RequestTargetFields {
  type: RequestType;
  title: string;
  description: string;
  attachments: File[];
}

/** Staff team-flow edit — any field left out is unchanged; `assignedToId: ''` unassigns. */
export interface RequestPatch {
  status?: RequestStatus;
  priority?: RequestPriority;
  assignedToId?: string;
}

/** Someone a request can be assigned to. */
export interface StaffOption {
  userId: string;
  fullName: string;
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
  return status !== 'Resolved' && status !== 'Closed' && status !== 'Rejected';
}

/**
 * Team statuses only move forward (Open=1 < InReview=2 < InProgress=3 < Resolved=4 < Closed=5);
 * the server answers an older one with 409 `status_cannot_go_back`. Staying put is allowed.
 * (Only the server reopens: a client reply to a resolved request → InReview.)
 */
export function canMoveStatus(from: RequestStatus, to: RequestStatus): boolean {
  const a = TEAM_STATUSES.indexOf(from);
  const b = TEAM_STATUSES.indexOf(to);
  return a >= 0 && b >= 0 && b >= a;
}

export function isTriageStatus(status: RequestStatus): boolean {
  return TRIAGE_STATUSES.includes(status);
}

/** An Admin decision is possible (approve / reject / ask). */
export function isAwaitingDecision(status: RequestStatus): boolean {
  return status === 'PendingReview' || status === 'NeedsClarification';
}

/** No more replies: closed by the team or declined by the Admin. */
export function isRequestLocked(status: RequestStatus): boolean {
  return status === 'Closed' || status === 'Rejected';
}
