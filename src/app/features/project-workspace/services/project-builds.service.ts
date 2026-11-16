import { Injectable, inject } from '@angular/core';
import {
  Observable,
  defer,
  distinctUntilChanged,
  switchMap,
  takeWhile,
  timer,
  takeUntil,
} from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService, UploadEvent } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import { BuildListQuery, NewBuildInput, ProjectBuild, isBuildInFlight } from '../models/workspace.models';

/** Poll a build every 3 s while it's being pushed, for at most 10 minutes. */
export const BUILD_POLL_MS = 3_000;
export const BUILD_POLL_MAX_MS = 10 * 60_000;

/** `admin` → `ManagerProjects/*` · `developer` → `DeveloperProjects/*` (same shapes). */
export type BuildsScope = 'admin' | 'developer';

/**
 * Build archive: list, upload (multipart with progress → 202 `Pending`),
 * poll until `Pushed` / `Failed`, retry.
 */
@Injectable({ providedIn: 'root' })
export class ProjectBuildsService {
  private readonly api = inject(ApiService);

  list(scope: BuildsScope, projectId: number, query: BuildListQuery = {}): Observable<PagedResult<ProjectBuild>> {
    const url =
      scope === 'admin'
        ? API_ENDPOINTS.managerProjects.builds(projectId)
        : API_ENDPOINTS.developerProjects.builds(projectId);
    return this.api.get<PagedResult<ProjectBuild>>(url, {
      params: { pageIndex: 1, pageSize: 20, ...query },
      context: withSkipLoader(),
    });
  }

  get(scope: BuildsScope, projectId: number, buildId: number): Observable<ProjectBuild> {
    const url =
      scope === 'admin'
        ? API_ENDPOINTS.managerProjects.build(projectId, buildId)
        : API_ENDPOINTS.developerProjects.build(projectId, buildId);
    return this.api.get<ProjectBuild>(url, { context: withSilentErrors(withSkipLoader()) });
  }

  /** Developers on the project upload (the backend checks membership). */
  upload(projectId: number, input: NewBuildInput): Observable<UploadEvent<ProjectBuild>> {
    const form = new FormData();
    form.append('versionName', input.versionName.trim());
    form.append('platform', input.platform);
    if (input.notes.trim()) form.append('notes', input.notes.trim());
    if (input.artifact) form.append('artifact', input.artifact, input.artifact.name);
    if (input.source.mode === 'archive') form.append('sourceArchive', input.source.file, input.source.file.name);
    else form.append('gitCommitSha', input.source.sha.trim());
    return this.api.upload<ProjectBuild>(API_ENDPOINTS.developerProjects.builds(projectId), form, {
      context: withInlineHandling(),
    });
  }

  retry(scope: BuildsScope, projectId: number, buildId: number): Observable<ProjectBuild> {
    const url =
      scope === 'admin'
        ? API_ENDPOINTS.managerProjects.buildRetry(projectId, buildId)
        : API_ENDPOINTS.developerProjects.buildRetry(projectId, buildId);
    return this.api.post<ProjectBuild>(url, {}, { context: withInlineHandling() });
  }

  /**
   * Re-reads a build every {@link BUILD_POLL_MS} while it is `Pending` /
   * `Uploading`; emits each change and completes once it settles (or after
   * {@link BUILD_POLL_MAX_MS}). Unsubscribing stops it.
   */
  watch(scope: BuildsScope, projectId: number, buildId: number): Observable<ProjectBuild> {
    return timer(BUILD_POLL_MS, BUILD_POLL_MS).pipe(
      takeUntil(timer(BUILD_POLL_MAX_MS)),
      switchMap(() => defer(() => this.get(scope, projectId, buildId))),
      distinctUntilChanged((a, b) => a.status === b.status && a.gitCommitSha === b.gitCommitSha),
      takeWhile((b) => isBuildInFlight(b.status), true),
    );
  }
}
