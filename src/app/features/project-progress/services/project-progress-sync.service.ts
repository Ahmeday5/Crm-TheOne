import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AppHubService } from '../../../core/realtime/app-hub.service';
import { ProjectListItem, projectProgressPercent } from '../../../shared/models';
import { ProjectProgressService } from './project-progress.service';

/** `ProjectProgressChanged` on `/hubs/app` (contract v2). */
export interface ProjectProgressChangedEvent {
  projectId: number;
  progressPercent: number;
  progressSource?: 'Team' | 'Milestones' | 'None';
  status?: string;
  changedAt?: string;
  cause?: 'DailyReport' | 'AdminAdjust' | 'TeamChanged' | 'MilestoneChanged';
}

/**
 * ONE progress number per project, shared by every screen (projects table,
 * workspace, reports) so they always agree and move together.
 *
 * Sources, freshest wins:
 *  1. live `ProjectProgressChanged` pushes from the hub;
 *  2. local writes (a daily report / adjust / team save just happened here);
 *  3. `ProjectProgress/{id}/summary` — the team-weighted number the workspace
 *     shows — fetched for rows whose list payload has no v2 `progressPercent`
 *     yet (drop this step once every list endpoint returns it).
 */
@Injectable({ providedIn: 'root' })
export class ProjectProgressSyncService {
  private readonly progressApi = inject(ProjectProgressService);
  private readonly hub = inject(AppHubService);

  private readonly map = signal<Record<number, number>>({});
  private readonly inflight = new Set<number>();
  /** Read-only view: `percents()[projectId]`. */
  readonly percents = this.map.asReadonly();

  constructor() {
    this.hub.on<ProjectProgressChangedEvent>('ProjectProgressChanged').subscribe((e) => {
      if (e?.projectId != null) this.set(e.projectId, e.progressPercent);
    });
  }

  /** The number to show for `row` (live/known value, else the row's own). */
  percentFor(row: Pick<ProjectListItem, 'id' | 'progressPercent' | 'overallProgressPercentage' | 'progress'>): number {
    return this.map()[row.id] ?? projectProgressPercent(row);
  }

  /** Records a fresh value (rounded to 2 decimals, clamped 0–100). */
  set(projectId: number, percent: number | null | undefined): void {
    if (percent == null || !Number.isFinite(Number(percent))) return;
    const value = Math.round(Math.max(0, Math.min(100, Number(percent))) * 100) / 100;
    if (this.map()[projectId] === value) return;
    this.map.update((m) => ({ ...m, [projectId]: value }));
  }

  /**
   * Makes sure the visible rows show the workspace's number: rows without a
   * v2 `progressPercent` get their summary (cached briefly by the HTTP layer).
   */
  hydrate(rows: ReadonlyArray<Pick<ProjectListItem, 'id' | 'progressPercent'>>, force = false): void {
    for (const row of rows) {
      if (row.progressPercent != null) {
        this.set(row.id, row.progressPercent);
        continue;
      }
      if (this.inflight.has(row.id) || (!force && this.map()[row.id] != null)) continue;
      this.inflight.add(row.id);
      this.progressApi
        .getSummary(row.id, force)
        .pipe(catchError(() => of(null)))
        .subscribe((s) => {
          this.inflight.delete(row.id);
          if (s) this.set(row.id, s.overallProgressPercentage);
        });
    }
  }
}
