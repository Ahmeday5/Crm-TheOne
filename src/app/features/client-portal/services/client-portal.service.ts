import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  ClientProject,
  ClientProjectDetails,
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  NewRequestInput,
  RequestListQuery,
  TimelineEvent,
} from '../models/client-portal.models';

/** `ClientPortal/*` — the signed-in client's own projects and requests (403 otherwise). */
@Injectable({ providedIn: 'root' })
export class ClientPortalService {
  private readonly api = inject(ApiService);

  myProjects(): Observable<ClientProject[]> {
    return this.api.get<ClientProject[]>(API_ENDPOINTS.clientPortal.myProjects, { context: withSkipLoader() });
  }

  project(projectId: number): Observable<ClientProjectDetails> {
    return this.api.get<ClientProjectDetails>(API_ENDPOINTS.clientPortal.project(projectId), {
      context: withSkipLoader(),
    });
  }

  timeline(projectId: number, pageIndex = 1, pageSize = 8): Observable<PagedResult<TimelineEvent>> {
    return this.api.get<PagedResult<TimelineEvent>>(API_ENDPOINTS.clientPortal.timeline(projectId), {
      params: { pageIndex, pageSize },
      context: withSkipLoader(),
    });
  }

  requests(projectId: number, query: RequestListQuery = {}): Observable<PagedResult<ClientRequestListItem>> {
    return this.api.get<PagedResult<ClientRequestListItem>>(API_ENDPOINTS.clientPortal.requests(projectId), {
      params: { pageIndex: 1, pageSize: 50, ...query },
      context: withSkipLoader(),
    });
  }

  createRequest(projectId: number, input: NewRequestInput): Observable<ClientRequestDetails> {
    const form = new FormData();
    form.append('type', input.type);
    form.append('title', input.title.trim());
    form.append('description', input.description.trim());
    for (const f of input.attachments) form.append('attachments', f, f.name);
    return this.api.post<ClientRequestDetails>(API_ENDPOINTS.clientPortal.requests(projectId), form, {
      context: withInlineHandling(),
    });
  }

  request(id: number): Observable<ClientRequestDetails> {
    return this.api.get<ClientRequestDetails>(API_ENDPOINTS.clientPortal.request(id), { context: withSkipLoader() });
  }

  comment(id: number, body: string, attachments: File[]): Observable<ClientRequestComment> {
    return this.api.post<ClientRequestComment>(API_ENDPOINTS.clientPortal.requestComments(id), toCommentForm(body, attachments), {
      context: withInlineHandling(),
    });
  }
}

export function toCommentForm(body: string, attachments: File[]): FormData {
  const form = new FormData();
  form.append('body', body.trim());
  for (const f of attachments) form.append('attachments', f, f.name);
  return form;
}
