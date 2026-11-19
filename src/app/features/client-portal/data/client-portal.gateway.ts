import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { isMocked } from '../../../core/constants/contract-mocks.const';
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
import { HttpClientPortalGateway } from './http-client-portal.gateway';
import { MockClientPortalGateway } from './mock-client-portal.gateway';

/**
 * Everything the client portal reads / writes (`ClientPortal/*`). One port,
 * two adapters: HTTP (the contract) and an in-memory mock — `CONTRACT_MOCKS.clientPortal`.
 */
export interface ClientPortalGateway {
  /** Anonymous: link token → portal JWT. Errors carry the contract `reason`. */
  startSession(request: PortalSessionRequest): Observable<PortalSessionResponse>;
  /** Anonymous, cacheable. */
  branding(): Observable<PortalBranding>;
  me(): Observable<PortalMe>;

  myProjects(): Observable<ClientProject[]>;
  project(projectId: number): Observable<ClientProjectDetails>;
  progressHistory(projectId: number, range: ProgressRange): Observable<ProgressPoint[]>;
  timeline(projectId: number, pageIndex: number, pageSize: number): Observable<PagedResult<TimelineEvent>>;

  credentials(projectId: number): Observable<ClientCredential[]>;
  revealCredential(projectId: number, credentialId: number): Observable<{ password: string }>;
  releases(projectId: number): Observable<ClientRelease[]>;
  downloadLink(projectId: number, releaseId: number): Observable<DownloadLink>;

  // Requests live in their own port: `PORTAL_REQUESTS_GATEWAY`.
}

export const CLIENT_PORTAL_GATEWAY = new InjectionToken<ClientPortalGateway>('CLIENT_PORTAL_GATEWAY', {
  providedIn: 'root',
  factory: () => (isMocked('clientPortal') ? inject(MockClientPortalGateway) : inject(HttpClientPortalGateway)),
});
