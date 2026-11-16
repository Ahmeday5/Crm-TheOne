import { Observable } from 'rxjs';
import {
  ClientProjectDetail,
  ClientProjectSummary,
  ClientRequest,
  NewRequestDraft,
  RequestComment,
  RequestPatch,
  TimelineEvent,
} from '../models/client-portal.models';

/**
 * Data port for the client portal and for staff answering client requests.
 *
 * Today: `MockClientPortalGateway` (in-memory). Production: an HTTP adapter on
 * `ClientPortal/*` (client side) and `ManagerProjects/{id}/client-requests`
 * (staff side), bound in `client-portal-gateway.provider.ts`. Streams are hot
 * and emit the full current snapshot, so a later push/poll swap is mechanical.
 */
export abstract class ClientPortalGateway {
  // ── client side (scoped to the signed-in client's projects) ──
  abstract myProjects$(): Observable<ClientProjectSummary[]>;
  abstract project$(projectId: number): Observable<ClientProjectDetail | null>;
  abstract timeline$(projectId: number): Observable<TimelineEvent[]>;

  // ── shared (client: own requests · staff: every request on the project) ──
  abstract requests$(projectId: number): Observable<ClientRequest[]>;
  abstract comments$(requestId: string): Observable<RequestComment[]>;
  abstract createRequest(draft: NewRequestDraft): Observable<ClientRequest>;
  abstract addComment(requestId: string, body: string, files: File[]): Observable<RequestComment>;

  // ── staff side ──
  abstract updateRequest(requestId: string, patch: RequestPatch): Observable<ClientRequest>;
}
