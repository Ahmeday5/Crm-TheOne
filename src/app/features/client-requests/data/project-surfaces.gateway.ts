import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { mockReply } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { ProjectSurface } from '../../client-portal/models/client-portal.models';
import { SurfaceInput } from '../models/client-requests.models';
import { ClientRequestsMockDb } from './mock/client-requests-mock.db';

/**
 * What a project is made of — website, dashboard, each app
 * (`ManagerProjects/{id}/surfaces`). The client picks one of these when
 * sending a request, so the team always knows which app it is about.
 */
export interface ProjectSurfacesGateway {
  list(projectId: number): Observable<ProjectSurface[]>;
  create(projectId: number, input: SurfaceInput): Observable<ProjectSurface>;
  update(projectId: number, id: number, input: SurfaceInput): Observable<ProjectSurface>;
  /** Soft-deletes (deactivates) when old requests point at it. */
  remove(projectId: number, id: number): Observable<unknown>;
  reorder(projectId: number, ids: number[]): Observable<unknown>;
}

const MP = API_ENDPOINTS.managerProjects;

@Injectable({ providedIn: 'root' })
export class HttpProjectSurfacesGateway implements ProjectSurfacesGateway {
  private readonly api = inject(ApiService);

  list(projectId: number): Observable<ProjectSurface[]> {
    return this.api.get<ProjectSurface[]>(MP.surfaces(projectId), { context: withSkipLoader() });
  }

  create(projectId: number, input: SurfaceInput): Observable<ProjectSurface> {
    return this.api.post<ProjectSurface>(MP.surfaces(projectId), input, { context: withInlineHandling() });
  }

  update(projectId: number, id: number, input: SurfaceInput): Observable<ProjectSurface> {
    return this.api.put<ProjectSurface>(MP.surface(projectId, id), input, { context: withInlineHandling() });
  }

  remove(projectId: number, id: number): Observable<unknown> {
    return this.api.delete<unknown>(MP.surface(projectId, id), { context: withInlineHandling() });
  }

  reorder(projectId: number, ids: number[]): Observable<unknown> {
    return this.api.put<unknown>(MP.surfacesOrder(projectId), { ids }, { context: withInlineHandling(withSkipLoader()) });
  }
}

@Injectable({ providedIn: 'root' })
export class MockProjectSurfacesGateway implements ProjectSurfacesGateway {
  private readonly db = inject(ClientRequestsMockDb);

  list(projectId: number): Observable<ProjectSurface[]> {
    return mockReply(() => this.db.surfaces(projectId));
  }

  create(projectId: number, input: SurfaceInput): Observable<ProjectSurface> {
    return mockReply(() => this.db.saveSurface(projectId, null, input));
  }

  update(projectId: number, id: number, input: SurfaceInput): Observable<ProjectSurface> {
    return mockReply(() => this.db.saveSurface(projectId, id, input));
  }

  remove(projectId: number, id: number): Observable<unknown> {
    return mockReply(() => this.db.deleteSurface(projectId, id));
  }

  reorder(projectId: number, ids: number[]): Observable<unknown> {
    return mockReply(() => this.db.reorderSurfaces(projectId, ids), 150);
  }
}

export const PROJECT_SURFACES_GATEWAY = new InjectionToken<ProjectSurfacesGateway>('PROJECT_SURFACES_GATEWAY', {
  providedIn: 'root',
  factory: () =>
    isMocked('clientRequestsTriage') ? inject(MockProjectSurfacesGateway) : inject(HttpProjectSurfacesGateway),
});
