import { Injectable, NgZone, inject } from '@angular/core';
import type { HubConnection } from '@microsoft/signalr';
import { Observable, Subject, filter, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { ProjectStatusName } from '../../../shared/models';
import { ProgressSource } from '../models/client-portal.models';
import { PortalSessionService } from './portal-session.service';
import { ClientRequestsMockDb } from '../../client-requests/data/mock/client-requests-mock.db';

/** `ProjectProgressChanged` as the portal receives it (no per-member data). */
export interface PortalProgressEvent {
  projectId: number;
  progressPercent: number;
  progressSource: ProgressSource;
  status: ProjectStatusName;
  changedAt: string;
}

/** `projectId` of an event whose project is unknown (another tab on the mock) — every open page refetches. */
export const ANY_PROJECT = 0;

/** Any other change worth a refetch of that project's sections. */
export interface PortalProjectEvent {
  projectId: number;
  kind: 'milestone' | 'release' | 'request';
}

const HUB_URL = `${environment.apiUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '')}/${API_ENDPOINTS.realtime.appHub}`;

/**
 * Live updates for the open portal: the server pushes to the
 * `client-customer-{id}` group over `/hubs/app`, authenticated with the
 * portal JWT. Pages patch in place (ring / chart / lists animate) instead of
 * reloading. Inert while the portal runs on its mock.
 */
@Injectable({ providedIn: 'root' })
export class PortalLiveService {
  private readonly session = inject(PortalSessionService);
  private readonly zone = inject(NgZone);

  private connection: HubConnection | null = null;
  private readonly progressSubject = new Subject<PortalProgressEvent>();
  private readonly projectSubject = new Subject<PortalProjectEvent>();

  readonly progress$: Observable<PortalProgressEvent> = this.progressSubject.asObservable();
  readonly projectChanged$: Observable<PortalProjectEvent> = this.projectSubject.asObservable();

  progressFor(projectId: number): Observable<PortalProgressEvent> {
    return this.progress$.pipe(filter((e) => e.projectId === projectId));
  }

  changesFor(projectId: number): Observable<PortalProjectEvent> {
    return this.projectChanged$.pipe(filter((e) => e.projectId === projectId || e.projectId === ANY_PROJECT));
  }

  constructor() {
    // Requests on the shared mock: the Admin acting in another tab shows up live here too.
    if (isMocked('clientRequestsTriage')) {
      inject(ClientRequestsMockDb).changes$.subscribe((projectId) =>
        this.projectSubject.next({ projectId: projectId ?? ANY_PROJECT, kind: 'request' }),
      );
    }
  }

  async start(): Promise<void> {
    if (this.connection || isMocked('clientPortal') || !this.session.isOpen()) return;
    const signalr = await import('@microsoft/signalr');
    const connection = new signalr.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => this.token() })
      .withAutomaticReconnect()
      .configureLogging(signalr.LogLevel.Error)
      .build();

    const progress = (e: PortalProgressEvent) => this.zone.run(() => this.progressSubject.next(e));
    const changed = (kind: PortalProjectEvent['kind']) => (e: { projectId: number }) =>
      this.zone.run(() => this.projectSubject.next({ projectId: e.projectId, kind }));
    connection.on('ProjectProgressChanged', progress);
    connection.on('ProjectMilestoneChanged', changed('milestone'));
    connection.on('ProjectReleasePublished', changed('release'));
    connection.on('ClientRequestUpdated', changed('request'));

    this.connection = connection;
    await this.zone.runOutsideAngular(() => connection.start()).catch(() => {
      // Live updates are a bonus — the pages still work by plain reads.
      this.connection = null;
    });
  }

  async stop(): Promise<void> {
    const c = this.connection;
    this.connection = null;
    await c?.stop().catch(() => undefined);
  }

  private async token(): Promise<string> {
    const fresh = this.session.freshAccessToken();
    if (fresh) return fresh;
    const s = await firstValueFrom(this.session.refresh());
    return s.accessToken;
  }
}
