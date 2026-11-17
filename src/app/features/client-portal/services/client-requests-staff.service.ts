import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withCache, withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  RequestListQuery,
  RequestPatch,
} from '../models/client-portal.models';
import { toCommentForm } from '../data/http-client-portal.gateway';

/** Someone a request can be assigned to. */
export interface StaffOption {
  userId: string;
  fullName: string;
}

/**
 * `ManagerProjects/{projectId}/client-requests/*` — admins and developers on
 * the project (others get 403).
 */
@Injectable({ providedIn: 'root' })
export class ClientRequestsStaffService {
  private readonly api = inject(ApiService);

  list(projectId: number, query: RequestListQuery = {}): Observable<PagedResult<ClientRequestListItem>> {
    return this.api.get<PagedResult<ClientRequestListItem>>(API_ENDPOINTS.managerProjects.clientRequests(projectId), {
      params: { pageIndex: 1, pageSize: 100, ...query },
      context: withSkipLoader(),
    });
  }

  get(projectId: number, id: number): Observable<ClientRequestDetails> {
    return this.api.get<ClientRequestDetails>(API_ENDPOINTS.managerProjects.clientRequest(projectId, id), {
      context: withSkipLoader(),
    });
  }

  patch(projectId: number, id: number, patch: RequestPatch): Observable<ClientRequestDetails> {
    return this.api.patch<ClientRequestDetails>(API_ENDPOINTS.managerProjects.clientRequest(projectId, id), patch, {
      context: withInlineHandling(),
    });
  }

  comment(projectId: number, id: number, body: string, attachments: File[]): Observable<ClientRequestComment> {
    return this.api.post<ClientRequestComment>(
      API_ENDPOINTS.managerProjects.clientRequestComments(projectId, id),
      toCommentForm(body, attachments),
      { context: withInlineHandling() },
    );
  }

  /** Admins (assignee picker). */
  admins(): Observable<StaffOption[]> {
    return this.api.get<StaffOption[]>(API_ENDPOINTS.auth.admins, { context: withCache({ ttlMs: CACHE_TTL.LONG }) });
  }
}
