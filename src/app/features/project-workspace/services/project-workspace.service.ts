import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import {
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  ProjectDeveloper,
  ProjectDeveloperInput,
  TimelineEvent,
} from '../models/workspace.models';

/** Project lists / details show team size and progress — refetch them after edits. */
const PROJECT_CACHE = ['Projects', 'AdminDashboard'];

/**
 * `ManagerProjects/{projectId}/*` (Admin): team + allocation and the timeline.
 * Milestones, deliverables and the client link live in their own gateways
 * (`data/`). Every call handles its own spinner and error text.
 */
@Injectable({ providedIn: 'root' })
export class ProjectWorkspaceService {
  private readonly api = inject(ApiService);

  // ─────────── team ───────────

  developers(projectId: number): Observable<ProjectDeveloper[]> {
    return this.api.get<ProjectDeveloper[]>(API_ENDPOINTS.managerProjects.developers(projectId), {
      context: withSkipLoader(),
    });
  }

  /** Replaces the whole team; returns the saved list. */
  saveDevelopers(projectId: number, developers: ProjectDeveloperInput[]): Observable<ProjectDeveloper[]> {
    return this.api.put<ProjectDeveloper[]>(
      API_ENDPOINTS.managerProjects.developers(projectId),
      { developers },
      { context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)) },
    );
  }

  // ─────────── timeline ───────────

  timeline(projectId: number, pageIndex = 1, pageSize = 20): Observable<PagedResult<TimelineEvent>> {
    return this.api.get<PagedResult<TimelineEvent>>(API_ENDPOINTS.managerProjects.timeline(projectId), {
      params: { pageIndex, pageSize },
      context: withSkipLoader(),
    });
  }
}
