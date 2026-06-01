import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  TeamWorkload,
  TeamWorkloadQuery,
  WorkloadDistributionItem,
} from '../../../shared/models';

/**
 * HTTP boundary for the `ResourceManagement/*` endpoints behind the
 * "Resource management & workload" board.
 *
 *   - `TeamWorkload` takes `Search` / `ProjectId` / `Priority` / `Sort` query
 *     params and drives the KPI strip + per-developer overview.
 *   - `WorkloadDistribution` is param-less and drives the distribution bars.
 */
@Injectable({ providedIn: 'root' })
export class ResourceManagementService {
  private readonly api = inject(ApiService);

  teamWorkload(query: TeamWorkloadQuery = {}): Observable<TeamWorkload> {
    return this.api.get<TeamWorkload>(
      API_ENDPOINTS.resourceManagement.teamWorkload,
      {
        params: query as Record<string, unknown>,
        context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
      },
    );
  }

  workloadDistribution(): Observable<WorkloadDistributionItem[]> {
    return this.api.get<WorkloadDistributionItem[]>(
      API_ENDPOINTS.resourceManagement.workloadDistribution,
      { context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })) },
    );
  }
}
