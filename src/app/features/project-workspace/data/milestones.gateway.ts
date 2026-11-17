import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { MockStore, daysFromNow, fail, mockReply, nowIso } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { WorkspaceScope } from '../models/deliverables.models';
import { Milestone, MilestoneInput, MilestoneStatus } from '../models/workspace.models';

/**
 * A project's milestones — the same contract for Admin (`ManagerProjects`)
 * and assigned developers (`DeveloperProjects`). Status → `PATCH …/{id}/status`,
 * reorder → `PUT …/milestones/order`; delete is Admin-only.
 */
export interface MilestonesGateway {
  list(projectId: number): Observable<Milestone[]>;
  create(projectId: number, body: MilestoneInput): Observable<Milestone>;
  update(projectId: number, id: number, body: MilestoneInput): Observable<Milestone>;
  setStatus(projectId: number, id: number, status: MilestoneStatus): Observable<Milestone>;
  reorder(projectId: number, ids: number[]): Observable<unknown>;
  remove(projectId: number, id: number): Observable<unknown>;
}

@Injectable({ providedIn: 'root' })
export class MilestonesService {
  private readonly api = inject(ApiService);
  private readonly mock = inject(MockDeveloperMilestonesGateway);
  private readonly http = {
    admin: new HttpMilestonesGateway(this.api, 'admin'),
    developer: new HttpMilestonesGateway(this.api, 'developer'),
  };

  /** Admin is live; developers run on the mock while `CONTRACT_MOCKS.developerMilestones` is on. */
  for(scope: WorkspaceScope): MilestonesGateway {
    if (scope === 'developer' && isMocked('developerMilestones')) return this.mock;
    return this.http[scope];
  }
}

class HttpMilestonesGateway implements MilestonesGateway {
  private readonly ep;

  constructor(
    private readonly api: ApiService,
    scope: WorkspaceScope,
  ) {
    this.ep = scope === 'admin' ? API_ENDPOINTS.managerProjects : API_ENDPOINTS.developerProjects;
  }

  list(projectId: number): Observable<Milestone[]> {
    return this.api.get<Milestone[]>(this.ep.milestones(projectId), { context: withSkipLoader() });
  }

  create(projectId: number, body: MilestoneInput): Observable<Milestone> {
    return this.api.post<Milestone>(this.ep.milestones(projectId), body, { context: withInlineHandling() });
  }

  update(projectId: number, id: number, body: MilestoneInput): Observable<Milestone> {
    return this.api.put<Milestone>(this.ep.milestone(projectId, id), body, { context: withInlineHandling() });
  }

  setStatus(projectId: number, id: number, status: MilestoneStatus): Observable<Milestone> {
    return this.api.patch<Milestone>(this.ep.milestoneStatus(projectId, id), { status }, { context: withInlineHandling() });
  }

  reorder(projectId: number, ids: number[]): Observable<unknown> {
    return this.api.put(this.ep.milestonesOrder(projectId), { ids }, { context: withInlineHandling() });
  }

  remove(projectId: number, id: number): Observable<unknown> {
    return this.api.delete(this.ep.milestone(projectId, id), { context: withInlineHandling() });
  }
}

// ─────────── mock (developer side only) ───────────

interface MilestoneDb {
  items: (Milestone & { projectId: number })[];
  nextId: number;
}

@Injectable({ providedIn: 'root' })
export class MockDeveloperMilestonesGateway implements MilestonesGateway {
  private readonly db = new MockStore<MilestoneDb>('crm_mock_dev_milestones_v2', () => ({ items: [], nextId: 1 }));

  list(projectId: number): Observable<Milestone[]> {
    return mockReply(() => {
      if (!this.db.get().items.some((m) => m.projectId === projectId)) this.seed(projectId);
      return this.db.get().items.filter((m) => m.projectId === projectId).map(strip);
    });
  }

  create(projectId: number, body: MilestoneInput): Observable<Milestone> {
    return mockReply(() => {
      const count = this.db.get().items.filter((m) => m.projectId === projectId).length;
      let id = 0;
      this.db.update((d) => (id = d.nextId++));
      const m = {
        projectId, id, title: body.title, description: body.description ?? null, status: body.status ?? 'Pending',
        dueDate: body.dueDate ?? null, completedAt: body.status === 'Done' ? nowIso() : null,
        orderIndex: body.orderIndex ?? count, createdByName: 'أنت', updatedByName: 'أنت', updatedAt: nowIso(),
      } satisfies Milestone & { projectId: number };
      this.db.update((d) => d.items.push(m));
      return strip(m);
    });
  }

  update(projectId: number, id: number, body: MilestoneInput): Observable<Milestone> {
    return mockReply(() => {
      const m = this.db.get().items.find((x) => x.id === id && x.projectId === projectId);
      if (!m) fail(404, 'not_found', 'Milestone not found');
      this.db.update(() => {
        const wasDone = m.status === 'Done';
        Object.assign(m, body, { updatedByName: 'أنت', updatedAt: nowIso() });
        if (m.status === 'Done' && !wasDone) m.completedAt = nowIso();
        if (m.status !== 'Done') m.completedAt = null;
      });
      return strip(m);
    });
  }

  setStatus(projectId: number, id: number, status: MilestoneStatus): Observable<Milestone> {
    return this.update(projectId, id, { status } as MilestoneInput);
  }

  reorder(projectId: number, ids: number[]): Observable<unknown> {
    return mockReply(() => {
      this.db.update((d) => d.items.forEach((m) => m.projectId === projectId && ids.includes(m.id) && (m.orderIndex = ids.indexOf(m.id))));
      return null;
    });
  }

  remove(): Observable<unknown> {
    return mockReply(() => fail(403, 'milestone_delete_admin_only', 'حذف المراحل للإدارة فقط'));
  }

  private seed(projectId: number): void {
    const titles: [string, Milestone['status'], number][] = [
      ['تحليل المتطلبات والتصميم', 'Done', -20],
      ['تطوير لوحة التحكم', 'InProgress', 7],
      ['تطبيق الموبايل', 'Pending', 20],
    ];
    this.db.update((d) =>
      titles.forEach(([title, status, due], i) =>
        d.items.push({
          projectId, id: d.nextId++, title, description: null, status, dueDate: daysFromNow(due),
          completedAt: status === 'Done' ? daysFromNow(due) : null, orderIndex: i,
          createdByName: 'Admin', updatedByName: 'Admin', updatedAt: daysFromNow(-2),
        }),
      ),
    );
  }
}

function strip(m: Milestone & { projectId: number }): Milestone {
  const { projectId, ...rest } = m;
  void projectId;
  return rest;
}
