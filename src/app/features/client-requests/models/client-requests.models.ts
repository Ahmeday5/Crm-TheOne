/**
 * Admin triage of client requests — `ClientRequests/*` (Admin only) and the
 * project surfaces (`ManagerProjects/{id}/surfaces`).
 * Contract: `docs/backend-prompt-client-requests-triage.md`.
 *
 * The request / comment shapes themselves are shared with the portal and live
 * in `client-portal.models.ts`.
 */
import {
  AppAudience,
  AppPlatform,
  RejectReasonCode,
  RequestPriority,
  RequestStatus,
  RequestTarget,
  RequestTargetFields,
  RequestType,
} from '../../client-portal/models/client-portal.models';

export type InboxSort = 'oldest' | 'newest';

/** `GET ClientRequests` — `Rejected` rows come back only when asked for explicitly. */
export interface InboxQuery {
  status?: RequestStatus | null;
  projectId?: number | null;
  customerId?: number | null;
  target?: RequestTarget | null;
  type?: RequestType | null;
  search?: string | null;
  sort?: InboxSort | null;
  pageIndex?: number;
  pageSize?: number;
}

/** `GET ClientRequests/summary` — sidebar badge + inbox header. */
export interface InboxSummary {
  pendingReview: number;
  /** Pending AND the customer answered the last question. */
  clientReplied: number;
  needsClarification: number;
  /** Open + InReview + InProgress. */
  approvedOpen: number;
  rejectedLast30Days: number;
  oldestPendingAt: string | null;
}

export const EMPTY_INBOX_SUMMARY: InboxSummary = {
  pendingReview: 0,
  clientReplied: 0,
  needsClarification: 0,
  approvedOpen: 0,
  rejectedLast30Days: 0,
  oldestPendingAt: null,
};

/** `POST ClientRequests/{id}/approve`. */
export interface ApproveRequestInput {
  priority: RequestPriority;
  assignedToId: string | null;
  internalNote: string | null;
  /** Optional rewrite of a vague title. */
  title: string | null;
}

/** `POST ClientRequests/{id}/reject`. */
export interface RejectRequestInput {
  reasonCode: RejectReasonCode;
  reason: string | null;
  notifyClient: boolean;
}

/** `PATCH ClientRequests/{id}/classification` — Admin corrects what the customer picked. */
export interface ClassificationPatch extends Partial<RequestTargetFields> {
  type?: RequestType;
}

/** `POST / PUT ManagerProjects/{id}/surfaces[/{surfaceId}]`. */
export interface SurfaceInput {
  kind: RequestTarget;
  appAudience: AppAudience | null;
  name: string;
  platforms: AppPlatform | null;
  url: string | null;
  isActive: boolean;
}

/** Realtime `ClientRequestUpdated` (`/hubs/app`) — Admins + the client always, developers for approved only. */
export interface ClientRequestUpdatedEvent {
  projectId: number;
  requestId: number;
  /** What happened (created / approved / commented …) — informative; the UI refetches either way. */
  changeType: string | null;
  status: RequestStatus;
  at: string;
}
