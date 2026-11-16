import { Observable } from 'rxjs';
import { AllocationDraft, ProjectDeveloper } from '../models/project-allocation.models';
import { NewBuildDraft, ProjectBuild } from '../models/project-build.models';

/**
 * Data port for the project build archive + developer allocation.
 *
 * The UI and stores depend only on this contract. Today it is backed by
 * `MockProjectBuildsGateway` (in-memory, simulated git push); the production
 * adapter will call `ManagerProjects/{id}/developers` and
 * `.../builds` (see the backend prompt) and is bound in
 * `project-builds-gateway.provider.ts` — nothing else changes.
 */
export abstract class ProjectBuildsGateway {
  // ── allocation ──
  /** The project's developers with their shares + task counters. */
  abstract developers$(projectId: number): Observable<ProjectDeveloper[]>;

  /** Replace the whole allocation list (bulk upsert). Rejects if the shares sum > 100. */
  abstract saveDevelopers(projectId: number, rows: AllocationDraft[]): Observable<ProjectDeveloper[]>;

  // ── builds ──
  /** The project's builds, newest first. */
  abstract builds$(projectId: number): Observable<ProjectBuild[]>;

  /**
   * Publish a new build. The returned build starts `Uploading`/`Pending` and
   * transitions to `Pushed` (or `Failed`) as the backend finishes the git push;
   * subscribers see the change through `builds$`.
   */
  abstract publishBuild(draft: NewBuildDraft): Observable<ProjectBuild>;
}
