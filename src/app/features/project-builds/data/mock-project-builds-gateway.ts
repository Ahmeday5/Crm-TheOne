import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AllocationDraft, ProjectDeveloper, totalAllocation } from '../models/project-allocation.models';
import { NewBuildDraft, ProjectBuild } from '../models/project-build.models';
import { ProjectBuildsGateway } from './project-builds-gateway';
import { mockId, seedBuilds, seedDevelopers } from './mock-project-builds.seed';

/** Simulated git-push latency (upload → pushed/failed). */
const PUSH_START_MS = 700;
const PUSH_DONE_MS = 2_600;
/** One in N mock pushes "fails", to exercise the failed state. */
const FAIL_EVERY = 5;

/**
 * TEMPORARY in-memory adapter for the build archive + allocation — preview
 * only, nothing leaves the browser. Simulates what the backend will do: a build
 * is published, "uploads", then the source is auto-pushed to GitHub and the row
 * flips to Pushed (or Failed). State is kept per project for the page's life.
 *
 * Provided at the route (see `provideProjectBuildsGateway()`).
 */
@Injectable()
export class MockProjectBuildsGateway extends ProjectBuildsGateway implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private readonly developersByProject = new Map<number, BehaviorSubject<ProjectDeveloper[]>>();
  private readonly buildsByProject = new Map<number, BehaviorSubject<ProjectBuild[]>>();
  private pushCounter = 0;

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  // ── allocation ──

  developers$(projectId: number): Observable<ProjectDeveloper[]> {
    return this.devSubject(projectId).asObservable();
  }

  saveDevelopers(projectId: number, rows: AllocationDraft[]): Observable<ProjectDeveloper[]> {
    if (totalAllocation(rows) > 100) {
      return throwError(() => new Error('مجموع النسب لا يمكن أن يتعدى 100%'));
    }
    const prev = new Map(this.devSubject(projectId).value.map((d) => [d.developerId, d]));
    const next: ProjectDeveloper[] = rows.map((r) => {
      const existing = prev.get(r.developerId);
      return {
        developerId: r.developerId,
        developerName: r.developerName,
        developerImageUrl: r.developerImageUrl,
        allocationPercent: Number(r.allocationPercent) || 0,
        roleOnProject: r.roleOnProject || null,
        tasksTotal: existing?.tasksTotal ?? 0,
        tasksDone: existing?.tasksDone ?? 0,
        assignedAt: existing?.assignedAt ?? new Date().toISOString(),
      };
    });
    this.devSubject(projectId).next(next);
    return of(next);
  }

  // ── builds ──

  builds$(projectId: number): Observable<ProjectBuild[]> {
    return this.buildsSubject(projectId).pipe(
      map((list) => [...list].sort((a, b) => b.buildNumber - a.buildNumber)),
    );
  }

  publishBuild(draft: NewBuildDraft): Observable<ProjectBuild> {
    const subject = this.buildsSubject(draft.projectId);
    const user = this.auth.currentUser();
    const nextNumber = Math.max(0, ...subject.value.map((b) => b.buildNumber)) + 1;
    const build: ProjectBuild = {
      id: mockId('build'),
      projectId: draft.projectId,
      buildNumber: nextNumber,
      versionName: draft.versionName.trim() || `0.0.${nextNumber}`,
      platform: draft.platform,
      developerId: user?.userId || 'me',
      developerName: user?.fullName || user?.email?.split('@')[0] || 'أنا',
      artifactUrl: draft.artifact ? '#' : null,
      artifactName: draft.artifact?.name ?? null,
      artifactSizeBytes: draft.artifact?.size ?? null,
      notes: draft.notes.trim() || null,
      gitRepoUrl: `https://github.com/the-one-system/project-${draft.projectId}`,
      gitBranch: 'main',
      gitCommitSha: null,
      gitTag: null,
      status: 'Uploading',
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };
    subject.next([build, ...subject.value]);
    this.simulatePush(draft.projectId, build.id, build.versionName);
    return of(build);
  }

  // ── internals ──

  /** Walk a build through Uploading → Pushed/Failed, emitting each change. */
  private simulatePush(projectId: number, buildId: string, versionName: string): void {
    const fails = ++this.pushCounter % FAIL_EVERY === 0;
    this.patchBuild(projectId, buildId, { status: 'Pending' }, PUSH_START_MS);
    this.patchBuild(
      projectId,
      buildId,
      fails
        ? { status: 'Failed', errorMessage: 'فشل الدفع على GitHub — تحقق من صلاحيات التوكن' }
        : {
            status: 'Pushed',
            gitCommitSha: Math.random().toString(16).slice(2, 9),
            gitTag: `v${versionName}`,
          },
      PUSH_DONE_MS,
    );
  }

  private patchBuild(projectId: number, buildId: string, patch: Partial<ProjectBuild>, delay: number): void {
    const timer = setTimeout(() => {
      const subject = this.buildsSubject(projectId);
      subject.next(subject.value.map((b) => (b.id === buildId ? { ...b, ...patch } : b)));
      this.timers.delete(timer);
    }, delay);
    this.timers.add(timer);
  }

  private devSubject(projectId: number): BehaviorSubject<ProjectDeveloper[]> {
    let s = this.developersByProject.get(projectId);
    if (!s) {
      s = new BehaviorSubject<ProjectDeveloper[]>(seedDevelopers());
      this.developersByProject.set(projectId, s);
    }
    return s;
  }

  private buildsSubject(projectId: number): BehaviorSubject<ProjectBuild[]> {
    let s = this.buildsByProject.get(projectId);
    if (!s) {
      s = new BehaviorSubject<ProjectBuild[]>(seedBuilds(projectId));
      this.buildsByProject.set(projectId, s);
    }
    return s;
  }
}
