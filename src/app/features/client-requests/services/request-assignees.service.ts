import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';
import { ProjectWorkspaceService } from '../../project-workspace/services/project-workspace.service';
import { StaffOption } from '../../client-portal/models/client-portal.models';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../data/staff-client-requests.gateway';

/**
 * Who a request can be assigned to: the project's developers, then the
 * Admins (deduplicated). Cached per project for the session — the picker opens
 * instantly the second time.
 */
@Injectable({ providedIn: 'root' })
export class RequestAssigneesService {
  private readonly workspace = inject(ProjectWorkspaceService);
  private readonly gateway = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly cache = new Map<number, Observable<StaffOption[]>>();

  forProject(projectId: number): Observable<StaffOption[]> {
    let cached = this.cache.get(projectId);
    if (!cached) {
      const devs$ = this.workspace.developers(projectId).pipe(
        map((list) => list.map((d) => ({ userId: d.developerId, fullName: d.developerName ?? '—' }))),
        catchError(() => of<StaffOption[]>([])),
      );
      const admins$ = this.gateway.admins().pipe(catchError(() => of<StaffOption[]>([])));
      cached = forkJoin([devs$, admins$]).pipe(
        map(([devs, admins]) => {
          const seen = new Set<string>();
          return [...devs, ...admins].filter((o) => !!o.userId && !seen.has(o.userId) && !!seen.add(o.userId));
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(projectId, cached);
    }
    return cached;
  }
}
