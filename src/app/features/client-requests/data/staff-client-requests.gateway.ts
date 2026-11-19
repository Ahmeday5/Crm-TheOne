import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map, switchMap, of, catchError } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withCache, withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { mockReply, page } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PagedResult } from '../../../shared/models';
import { commentBody, toCommentForm } from '../../client-portal/data/portal-requests.gateway';
import {
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  RequestListQuery,
  RequestPatch,
  StaffOption,
} from '../../client-portal/models/client-portal.models';
import {
  ApproveRequestInput,
  ClassificationPatch,
  InboxQuery,
  InboxSummary,
  RejectRequestInput,
} from '../models/client-requests.models';
import { ClientRequestsMockDb, StaffActor } from './mock/client-requests-mock.db';

/**
 * Client requests, staff side:
 *  - project scope `ManagerProjects/{id}/client-requests*` (Admin + project developers;
 *    developers only ever get approved requests — enforced server-side);
 *  - the Admin inbox + triage `ClientRequests/*` (Admin only).
 */
export interface StaffClientRequestsGateway {
  // ── project scope ──
  list(projectId: number, query?: RequestListQuery): Observable<PagedResult<ClientRequestListItem>>;
  get(projectId: number, id: number): Observable<ClientRequestDetails>;
  patch(projectId: number, id: number, patch: RequestPatch): Observable<ClientRequestDetails>;
  comment(projectId: number, id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment>;

  // ── Admin inbox / triage ──
  inbox(query: InboxQuery): Observable<PagedResult<ClientRequestListItem>>;
  summary(): Observable<InboxSummary>;
  detail(id: number): Observable<ClientRequestDetails>;
  approve(id: number, input: ApproveRequestInput): Observable<ClientRequestDetails>;
  reject(id: number, input: RejectRequestInput): Observable<ClientRequestDetails>;
  clarify(id: number, question: string, attachments: File[]): Observable<ClientRequestDetails>;
  reopenReview(id: number): Observable<ClientRequestDetails>;
  classify(id: number, patch: ClassificationPatch): Observable<ClientRequestDetails>;
  adminComment(id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment>;

  /** Admins (assignee picker) — a live endpoint, never mocked. */
  admins(): Observable<StaffOption[]>;
}

const MP = API_ENDPOINTS.managerProjects;
const CR = API_ENDPOINTS.clientRequests;

@Injectable({ providedIn: 'root' })
export class HttpStaffClientRequestsGateway implements StaffClientRequestsGateway {
  private readonly api = inject(ApiService);

  list(projectId: number, query: RequestListQuery = {}): Observable<PagedResult<ClientRequestListItem>> {
    return this.api.get<PagedResult<ClientRequestListItem>>(MP.clientRequests(projectId), {
      params: { pageIndex: 1, pageSize: 100, ...clean(query) },
      context: withSkipLoader(),
    });
  }

  get(projectId: number, id: number): Observable<ClientRequestDetails> {
    return this.api.get<ClientRequestDetails>(MP.clientRequest(projectId, id), { context: withSkipLoader() });
  }

  patch(projectId: number, id: number, patch: RequestPatch): Observable<ClientRequestDetails> {
    return this.api.patch<ClientRequestDetails>(MP.clientRequest(projectId, id), patch, { context: withInlineHandling() });
  }

  comment(projectId: number, id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment> {
    return this.api.post<ClientRequestComment>(
      MP.clientRequestComments(projectId, id),
      toCommentForm(body, attachments, { isInternal: String(isInternal) }),
      { context: withInlineHandling() },
    );
  }

  inbox(query: InboxQuery): Observable<PagedResult<ClientRequestListItem>> {
    return this.api.get<PagedResult<ClientRequestListItem>>(CR.list, {
      params: { pageIndex: 1, pageSize: 20, ...clean(query) },
      context: withSkipLoader(),
    });
  }

  summary(): Observable<InboxSummary> {
    return this.api.get<InboxSummary>(CR.summary, { context: withSkipLoader(withInlineHandling()) });
  }

  detail(id: number): Observable<ClientRequestDetails> {
    return this.api.get<ClientRequestDetails>(CR.byId(id), { context: withSkipLoader() });
  }

  approve(id: number, input: ApproveRequestInput): Observable<ClientRequestDetails> {
    return this.api.post<ClientRequestDetails>(CR.approve(id), input, { context: withInlineHandling() });
  }

  reject(id: number, input: RejectRequestInput): Observable<ClientRequestDetails> {
    return this.api.post<ClientRequestDetails>(CR.reject(id), input, { context: withInlineHandling() });
  }

  clarify(id: number, question: string, attachments: File[]): Observable<ClientRequestDetails> {
    const form = new FormData();
    form.append('question', commentBody(question, attachments));
    for (const f of attachments) form.append('attachments', f, f.name);
    return this.api.post<ClientRequestDetails>(CR.clarify(id), form, { context: withInlineHandling() });
  }

  reopenReview(id: number): Observable<ClientRequestDetails> {
    return this.api.post<ClientRequestDetails>(CR.reopenReview(id), {}, { context: withInlineHandling() });
  }

  classify(id: number, patch: ClassificationPatch): Observable<ClientRequestDetails> {
    return this.api.patch<ClientRequestDetails>(CR.classification(id), patch, { context: withInlineHandling() });
  }

  adminComment(id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment> {
    return this.api.post<ClientRequestComment>(
      CR.comments(id),
      toCommentForm(body, attachments, { isInternal: String(isInternal) }),
      { context: withInlineHandling() },
    );
  }

  admins(): Observable<StaffOption[]> {
    return this.api.get<StaffOption[]>(API_ENDPOINTS.auth.admins, { context: withCache({ ttlMs: CACHE_TTL.LONG }) });
  }
}

/** Same interface over the shared in-memory store — acts as the signed-in staff user. */
@Injectable({ providedIn: 'root' })
export class MockStaffClientRequestsGateway implements StaffClientRequestsGateway {
  private readonly db = inject(ClientRequestsMockDb);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpStaffClientRequestsGateway);

  list(projectId: number, query: RequestListQuery = {}): Observable<PagedResult<ClientRequestListItem>> {
    return mockReply(() => {
      const rows = this.db.projectList(projectId, query.status, this.actor()).filter((r) => !query.type || r.type === query.type);
      return page(rows, query.pageIndex ?? 1, query.pageSize ?? 100);
    });
  }

  get(projectId: number, id: number): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.staffGet(id, this.actor(), projectId));
  }

  patch(projectId: number, id: number, patch: RequestPatch): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.patch(projectId, id, patch, this.actor()));
  }

  comment(projectId: number, id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment> {
    return mockReply(() => {
      this.db.staffGet(id, this.actor(), projectId);
      return this.db.staffComment(id, body, attachments, isInternal, this.actor());
    });
  }

  inbox(query: InboxQuery): Observable<PagedResult<ClientRequestListItem>> {
    return mockReply(() => this.db.inbox(query, this.adminActor()));
  }

  summary(): Observable<InboxSummary> {
    return mockReply(() => this.db.summary(), 200);
  }

  detail(id: number): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.staffGet(id, this.adminActor()));
  }

  approve(id: number, input: ApproveRequestInput): Observable<ClientRequestDetails> {
    // Resolve the assignee's display name the way the server would.
    const name$ = input.assignedToId
      ? this.admins().pipe(
          catchError(() => of([] as StaffOption[])),
          map((list) => list.find((a) => a.userId === input.assignedToId)?.fullName ?? null),
        )
      : of(null);
    return name$.pipe(switchMap((name) => mockReply(() => this.db.approve(id, input, this.adminActor(), name), 500)));
  }

  reject(id: number, input: RejectRequestInput): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.reject(id, input, this.adminActor()), 500);
  }

  clarify(id: number, question: string, attachments: File[]): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.clarify(id, question, attachments, this.adminActor()), 500);
  }

  reopenReview(id: number): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.reopenReview(id, this.adminActor()));
  }

  classify(id: number, patch: ClassificationPatch): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.classify(id, patch, this.adminActor()));
  }

  adminComment(id: number, body: string, attachments: File[], isInternal: boolean): Observable<ClientRequestComment> {
    return mockReply(() => this.db.staffComment(id, body, attachments, isInternal, this.adminActor()));
  }

  admins(): Observable<StaffOption[]> {
    return this.http.admins();
  }

  private actor(): StaffActor {
    const u = this.auth.currentUser();
    return {
      userId: u?.userId ?? 'me',
      name: u?.fullName || u?.email || '—',
      role: u?.role === 'Admin' ? 'Admin' : 'Developer',
    };
  }

  private adminActor(): StaffActor {
    return { ...this.actor(), role: 'Admin' };
  }
}

export const STAFF_CLIENT_REQUESTS_GATEWAY = new InjectionToken<StaffClientRequestsGateway>('STAFF_CLIENT_REQUESTS_GATEWAY', {
  providedIn: 'root',
  factory: () =>
    isMocked('clientRequestsTriage') ? inject(MockStaffClientRequestsGateway) : inject(HttpStaffClientRequestsGateway),
});

/** Drops empty filters so they never reach the query string. */
function clean<T extends object>(query: T): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v as string | number;
  }
  return out;
}
