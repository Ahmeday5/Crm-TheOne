import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { mockReply, page } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import { ClientRequestsMockDb } from '../../client-requests/data/mock/client-requests-mock.db';
import {
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  NewRequestInput,
  RequestListQuery,
  RequestOptions,
} from '../models/client-portal.models';
import { PortalSessionService } from '../services/portal-session.service';

/**
 * The customer's requests inside the portal (`ClientPortal/…/requests*`).
 * Its own port, so it can run on the shared triage mock
 * (`CONTRACT_MOCKS.clientRequestsTriage`) while the rest of the portal is live.
 */
export interface PortalRequestsGateway {
  /** What the "new request" picker offers for this project. */
  options(projectId: number): Observable<RequestOptions>;
  list(projectId: number, query: RequestListQuery): Observable<PagedResult<ClientRequestListItem>>;
  create(projectId: number, input: NewRequestInput): Observable<ClientRequestDetails>;
  get(id: number): Observable<ClientRequestDetails>;
  /** While `NeedsClarification` this is the answer — the server moves it back to review. */
  comment(id: number, body: string, attachments: File[]): Observable<ClientRequestComment>;
}

const EP = API_ENDPOINTS.clientPortal;

@Injectable({ providedIn: 'root' })
export class HttpPortalRequestsGateway implements PortalRequestsGateway {
  private readonly api = inject(ApiService);

  options(projectId: number): Observable<RequestOptions> {
    return this.api.get<RequestOptions>(EP.requestOptions(projectId), { context: withSkipLoader() });
  }

  list(projectId: number, query: RequestListQuery): Observable<PagedResult<ClientRequestListItem>> {
    return this.api.get<PagedResult<ClientRequestListItem>>(EP.requests(projectId), {
      params: { pageIndex: 1, pageSize: 50, ...query },
      context: withSkipLoader(),
    });
  }

  create(projectId: number, input: NewRequestInput): Observable<ClientRequestDetails> {
    const form = new FormData();
    form.append('type', input.type);
    form.append('title', input.title.trim());
    form.append('description', input.description.trim());
    form.append('target', input.target);
    appendIf(form, 'surfaceId', input.surfaceId);
    appendIf(form, 'appAudience', input.appAudience);
    appendIf(form, 'appName', input.appName?.trim());
    appendIf(form, 'appPlatform', input.appPlatform);
    for (const f of input.attachments) form.append('attachments', f, f.name);
    return this.api.post<ClientRequestDetails>(EP.requests(projectId), form, { context: withInlineHandling() });
  }

  get(id: number): Observable<ClientRequestDetails> {
    return this.api.get<ClientRequestDetails>(EP.request(id), { context: withSkipLoader() });
  }

  comment(id: number, body: string, attachments: File[]): Observable<ClientRequestComment> {
    return this.api.post<ClientRequestComment>(EP.requestComments(id), toCommentForm(body, attachments), {
      context: withInlineHandling(),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class MockPortalRequestsGateway implements PortalRequestsGateway {
  private readonly db = inject(ClientRequestsMockDb);
  private readonly session = inject(PortalSessionService);

  options(projectId: number): Observable<RequestOptions> {
    return mockReply(() => this.db.requestOptions(projectId));
  }

  list(projectId: number, query: RequestListQuery): Observable<PagedResult<ClientRequestListItem>> {
    return mockReply(() => {
      const rows = this.db
        .clientList(projectId, this.session.customer()?.id ?? null)
        .filter((r) => (!query.status || r.status === query.status) && (!query.type || r.type === query.type));
      return page(rows, query.pageIndex ?? 1, query.pageSize ?? 50);
    });
  }

  create(projectId: number, input: NewRequestInput): Observable<ClientRequestDetails> {
    const customer = this.session.customer();
    return mockReply(
      () =>
        this.db.clientCreate(projectId, input, {
          customerId: customer?.id ?? null,
          customerName: customer?.companyName || customer?.name || null,
          visitorName: this.session.visitorName() || customer?.name || null,
        }),
      700,
    );
  }

  get(id: number): Observable<ClientRequestDetails> {
    return mockReply(() => this.db.clientGet(id));
  }

  comment(id: number, body: string, attachments: File[]): Observable<ClientRequestComment> {
    return mockReply(() => this.db.clientComment(id, body, attachments));
  }
}

export const PORTAL_REQUESTS_GATEWAY = new InjectionToken<PortalRequestsGateway>('PORTAL_REQUESTS_GATEWAY', {
  providedIn: 'root',
  factory: () =>
    isMocked('clientRequestsTriage') ? inject(MockPortalRequestsGateway) : inject(HttpPortalRequestsGateway),
});

/**
 * Multipart body of every reply (client, staff, Admin). The server requires a
 * non-empty `body`, so a reply with only files says what was attached
 * ("📎 receipt.jpg") — readable in the thread on both sides.
 */
export function toCommentForm(body: string, attachments: File[], extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append('body', commentBody(body, attachments));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  for (const f of attachments) form.append('attachments', f, f.name);
  return form;
}

export function commentBody(body: string, attachments: File[]): string {
  const text = body.trim();
  if (text || !attachments.length) return text;
  return attachments.map((f) => `📎 ${f.name}`).join(' · ');
}

function appendIf(form: FormData, key: string, value: string | number | null | undefined): void {
  if (value !== null && value !== undefined && value !== '') form.append(key, String(value));
}
