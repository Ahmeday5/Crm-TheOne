import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import { withCache } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { AdminDashboardData } from '../../../shared/models';

/**
 * HTTP boundary for the admin/manager landing dashboard.
 *
 * A single `GET /AdminDashboard` call returns every KPI tile, the contract
 * revenue block, and the monthly buyers + revenue trends. SHORT cache — the
 * page is revisited often and the numbers don't need to be second-fresh.
 */
@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(ApiService);

  dashboard(): Observable<AdminDashboardData> {
    return this.api.get<AdminDashboardData>(API_ENDPOINTS.adminDashboard.get, {
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }
}
