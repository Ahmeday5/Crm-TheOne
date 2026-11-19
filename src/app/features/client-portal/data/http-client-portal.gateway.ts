import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withInlineHandling,
  withSkipAuth,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  ClientCredential,
  ClientProject,
  ClientProjectDetails,
  ClientRelease,
  DownloadLink,
  PortalBranding,
  PortalMe,
  ProgressPoint,
  ProgressRange,
  TimelineEvent,
} from '../models/client-portal.models';
import { PortalSessionRequest, PortalSessionResponse } from '../models/portal-session.models';
import { ClientPortalGateway } from './client-portal.gateway';

const EP = API_ENDPOINTS.clientPortal;

/**
 * `ClientPortal/*` over HTTP. The portal JWT is attached by
 * `portalSessionInterceptor` (never the staff token); every call handles its
 * own spinner / error text.
 */
@Injectable({ providedIn: 'root' })
export class HttpClientPortalGateway implements ClientPortalGateway {
  private readonly api = inject(ApiService);

  startSession(request: PortalSessionRequest): Observable<PortalSessionResponse> {
    return this.api.post<PortalSessionResponse>(EP.session, request, {
      context: withSkipAuth(withInlineHandling()),
    });
  }

  branding(): Observable<PortalBranding> {
    return this.api.get<PortalBranding>(EP.branding, {
      context: withSkipAuth(withSkipLoader(withCache({ ttlMs: CACHE_TTL.LONG }))),
    });
  }

  me(): Observable<PortalMe> {
    return this.api.get<PortalMe>(EP.me, { context: withSkipLoader() });
  }

  myProjects(): Observable<ClientProject[]> {
    return this.api.get<ClientProject[]>(EP.myProjects, { context: withSkipLoader() });
  }

  project(projectId: number): Observable<ClientProjectDetails> {
    return this.api.get<ClientProjectDetails>(EP.project(projectId), { context: withSkipLoader() });
  }

  progressHistory(projectId: number, range: ProgressRange): Observable<ProgressPoint[]> {
    return this.api.get<ProgressPoint[]>(EP.progressHistory(projectId), {
      params: { range },
      context: withSkipLoader(),
    });
  }

  timeline(projectId: number, pageIndex: number, pageSize: number): Observable<PagedResult<TimelineEvent>> {
    return this.api.get<PagedResult<TimelineEvent>>(EP.timeline(projectId), {
      params: { pageIndex, pageSize },
      context: withSkipLoader(),
    });
  }

  credentials(projectId: number): Observable<ClientCredential[]> {
    return this.api.get<ClientCredential[]>(EP.credentials(projectId), { context: withSkipLoader() });
  }

  revealCredential(projectId: number, credentialId: number): Observable<{ password: string }> {
    return this.api.post<{ password: string }>(EP.credentialReveal(projectId, credentialId), {}, {
      context: withInlineHandling(),
    });
  }

  releases(projectId: number): Observable<ClientRelease[]> {
    return this.api.get<ClientRelease[]>(EP.releases(projectId), { context: withSkipLoader() });
  }

  downloadLink(projectId: number, releaseId: number): Observable<DownloadLink> {
    return this.api.post<DownloadLink>(EP.releaseDownloadLink(projectId, releaseId), {}, {
      context: withInlineHandling(),
    });
  }
}
