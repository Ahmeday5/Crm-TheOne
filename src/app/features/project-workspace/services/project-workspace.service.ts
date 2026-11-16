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
  ClientAccessInput,
  ClientAccessResult,
  ClientAccessStatus,
  GitSettings,
  GitSettingsInput,
  Milestone,
  MilestoneInput,
  ProjectDeveloper,
  ProjectDeveloperInput,
  TimelineEvent,
} from '../models/workspace.models';

/** Project lists / details show team size, client access and git fields — refetch them after edits. */
const PROJECT_CACHE = ['Projects', 'AdminDashboard'];

/**
 * `ManagerProjects/{projectId}/*` (Admin): team + allocation, milestones,
 * timeline, client-portal access and GitHub settings. Every call handles its
 * own spinner and error text (no global overlay / toast).
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

  // ─────────── milestones ───────────

  milestones(projectId: number): Observable<Milestone[]> {
    return this.api.get<Milestone[]>(API_ENDPOINTS.managerProjects.milestones(projectId), {
      context: withSkipLoader(),
    });
  }

  createMilestone(projectId: number, body: MilestoneInput): Observable<Milestone> {
    return this.api.post<Milestone>(API_ENDPOINTS.managerProjects.milestones(projectId), body, {
      context: withInlineHandling(),
    });
  }

  updateMilestone(projectId: number, id: number, body: MilestoneInput): Observable<Milestone> {
    return this.api.put<Milestone>(API_ENDPOINTS.managerProjects.milestone(projectId, id), body, {
      context: withInlineHandling(),
    });
  }

  deleteMilestone(projectId: number, id: number): Observable<unknown> {
    return this.api.delete(API_ENDPOINTS.managerProjects.milestone(projectId, id), {
      context: withInlineHandling(),
    });
  }

  // ─────────── timeline ───────────

  timeline(projectId: number, pageIndex = 1, pageSize = 20): Observable<PagedResult<TimelineEvent>> {
    return this.api.get<PagedResult<TimelineEvent>>(API_ENDPOINTS.managerProjects.timeline(projectId), {
      params: { pageIndex, pageSize },
      context: withSkipLoader(),
    });
  }

  // ─────────── client access ───────────

  clientAccess(projectId: number): Observable<ClientAccessStatus> {
    return this.api.get<ClientAccessStatus>(API_ENDPOINTS.managerProjects.clientAccess(projectId), {
      context: withSkipLoader(),
    });
  }

  /** Creates the client's account, or re-invites (new temporary password) for the same email. */
  grantClientAccess(projectId: number, body: ClientAccessInput): Observable<ClientAccessResult> {
    return this.api.post<ClientAccessResult>(API_ENDPOINTS.managerProjects.clientAccess(projectId), body, {
      context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)),
    });
  }

  revokeClientAccess(projectId: number): Observable<unknown> {
    return this.api.delete(API_ENDPOINTS.managerProjects.clientAccess(projectId), {
      context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)),
    });
  }

  // ─────────── GitHub ───────────

  gitSettings(projectId: number): Observable<GitSettings> {
    return this.api.get<GitSettings>(API_ENDPOINTS.managerProjects.gitSettings(projectId), {
      context: withSkipLoader(),
    });
  }

  saveGitSettings(projectId: number, body: GitSettingsInput): Observable<GitSettings> {
    return this.api.put<GitSettings>(API_ENDPOINTS.managerProjects.gitSettings(projectId), body, {
      context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)),
    });
  }
}
