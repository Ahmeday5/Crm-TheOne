import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { MockStore, daysFromNow, fail, mockReply, mockUpload, nowIso, page } from '../../../core/mocks/mock-http.util';
import { ApiService, UploadEvent } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  AccessCredential,
  CredentialInput,
  NewReleaseInput,
  ProjectRelease,
  ReleaseListQuery,
  ReleasePatch,
  WorkspaceScope,
} from '../models/deliverables.models';

/**
 * Deliverables of one project (`…/{id}/credentials`, `…/{id}/releases`), the
 * same contract for Admin (`ManagerProjects`) and assigned developers
 * (`DeveloperProjects`).
 */
export interface DeliverablesGateway {
  credentials(projectId: number): Observable<AccessCredential[]>;
  createCredential(projectId: number, input: CredentialInput): Observable<AccessCredential>;
  updateCredential(projectId: number, id: number, input: CredentialInput): Observable<AccessCredential>;
  deleteCredential(projectId: number, id: number): Observable<unknown>;
  revealCredential(projectId: number, id: number): Observable<{ password: string }>;
  reorderCredentials(projectId: number, ids: number[]): Observable<unknown>;

  releases(projectId: number, query: ReleaseListQuery): Observable<PagedResult<ProjectRelease>>;
  /** Multipart, with upload progress. */
  uploadRelease(projectId: number, input: NewReleaseInput): Observable<UploadEvent<ProjectRelease>>;
  updateRelease(projectId: number, id: number, patch: ReleasePatch): Observable<ProjectRelease>;
  deleteRelease(projectId: number, id: number): Observable<unknown>;
  /** Staff download URL (auth header needed → fetched as a blob by the caller). */
  downloadUrl(projectId: number, id: number): string;
}

@Injectable({ providedIn: 'root' })
export class DeliverablesService {
  private readonly api = inject(ApiService);
  private readonly mock = inject(MockDeliverablesGateway);
  private readonly http = {
    admin: new HttpDeliverablesGateway(this.api, 'admin'),
    developer: new HttpDeliverablesGateway(this.api, 'developer'),
  };

  /** The gateway for `scope` — the mock while `CONTRACT_MOCKS.deliverables` is on. */
  for(scope: WorkspaceScope): DeliverablesGateway {
    return isMocked('deliverables') ? this.mock : this.http[scope];
  }
}

class HttpDeliverablesGateway implements DeliverablesGateway {
  private readonly ep;

  constructor(
    private readonly api: ApiService,
    scope: WorkspaceScope,
  ) {
    this.ep = scope === 'admin' ? API_ENDPOINTS.managerProjects : API_ENDPOINTS.developerProjects;
  }

  credentials(projectId: number): Observable<AccessCredential[]> {
    return this.api.get<AccessCredential[]>(this.ep.credentials(projectId), { context: withSkipLoader() });
  }

  createCredential(projectId: number, input: CredentialInput): Observable<AccessCredential> {
    return this.api.post<AccessCredential>(this.ep.credentials(projectId), input, { context: withInlineHandling() });
  }

  updateCredential(projectId: number, id: number, input: CredentialInput): Observable<AccessCredential> {
    return this.api.put<AccessCredential>(this.ep.credential(projectId, id), input, { context: withInlineHandling() });
  }

  deleteCredential(projectId: number, id: number): Observable<unknown> {
    return this.api.delete(this.ep.credential(projectId, id), { context: withInlineHandling() });
  }

  revealCredential(projectId: number, id: number): Observable<{ password: string }> {
    return this.api.post<{ password: string }>(this.ep.credentialReveal(projectId, id), {}, { context: withInlineHandling() });
  }

  reorderCredentials(projectId: number, ids: number[]): Observable<unknown> {
    return this.api.put(this.ep.credentialsOrder(projectId), { ids }, { context: withInlineHandling() });
  }

  releases(projectId: number, query: ReleaseListQuery): Observable<PagedResult<ProjectRelease>> {
    return this.api.get<PagedResult<ProjectRelease>>(this.ep.releases(projectId), {
      params: { pageIndex: 1, pageSize: 20, ...query },
      context: withSkipLoader(),
    });
  }

  uploadRelease(projectId: number, input: NewReleaseInput): Observable<UploadEvent<ProjectRelease>> {
    const form = new FormData();
    form.append('versionName', input.versionName.trim());
    form.append('platform', input.platform);
    form.append('stage', input.stage);
    form.append('isVisibleToClient', String(input.isVisibleToClient));
    if (input.releaseNotes?.trim()) form.append('releaseNotes', input.releaseNotes.trim());
    if (input.externalUrl?.trim()) form.append('externalUrl', input.externalUrl.trim());
    if (input.file) form.append('file', input.file, input.file.name);
    return this.api.upload<ProjectRelease>(this.ep.releases(projectId), form, { context: withInlineHandling() });
  }

  updateRelease(projectId: number, id: number, patch: ReleasePatch): Observable<ProjectRelease> {
    return this.api.patch<ProjectRelease>(this.ep.release(projectId, id), patch, { context: withInlineHandling() });
  }

  deleteRelease(projectId: number, id: number): Observable<unknown> {
    return this.api.delete(this.ep.release(projectId, id), { context: withInlineHandling() });
  }

  downloadUrl(projectId: number, id: number): string {
    return this.ep.releaseDownload(projectId, id);
  }
}

// ─────────── mock ───────────

interface MockCredential extends AccessCredential {
  password: string | null;
}

interface DeliverablesDb {
  credentials: MockCredential[];
  releases: ProjectRelease[];
  nextId: number;
}

function seedFor(projectId: number, nextId: number): { credentials: MockCredential[]; releases: ProjectRelease[] } {
  return {
    credentials: [
      {
        id: nextId, projectId, title: 'لوحة التحكم', kind: 'WebDashboard', environment: 'Staging',
        url: 'https://demo.theonesystemco.com/admin', username: 'client@demo.com', hasPassword: true, password: 'Demo@2026',
        notes: 'نسخة تجريبية — البيانات للتجربة فقط.', isVisibleToClient: true, orderIndex: 0,
        createdAt: daysFromNow(-9), updatedAt: daysFromNow(-1), updatedByName: 'Ahmed',
      },
    ],
    releases: [
      {
        id: nextId + 1, projectId, platform: 'Android', versionName: '1.3.0', buildNumber: 7, stage: 'Beta',
        releaseNotes: 'شاشة الطلبات الجديدة\nإشعارات فورية', fileName: 'app-1.3.0.apk', fileSizeBytes: 38_412_288,
        fileSha256: null, externalUrl: null, hasFile: true, apkPackageName: 'com.theone.app', apkVersionCode: 7,
        isVisibleToClient: true, isLatest: true, uploadedById: null, uploadedByName: 'ali', downloadCount: 4,
        createdAt: daysFromNow(-1),
      },
    ],
  };
}

/** In-memory deliverables (per project, seeded on first look). */
@Injectable({ providedIn: 'root' })
export class MockDeliverablesGateway implements DeliverablesGateway {
  private readonly db = new MockStore<DeliverablesDb>('crm_mock_deliverables_v2', () => ({ credentials: [], releases: [], nextId: 1 }));
  private readonly seeded = new Set<number>();

  credentials(projectId: number): Observable<AccessCredential[]> {
    return mockReply(() => this.creds(projectId).map(strip));
  }

  createCredential(projectId: number, input: CredentialInput): Observable<AccessCredential> {
    return mockReply(() => {
      const c: MockCredential = {
        ...input, id: this.bump(), projectId, hasPassword: !!input.password, password: input.password || null,
        orderIndex: this.creds(projectId).length, createdAt: nowIso(), updatedAt: null, updatedByName: 'أنت',
      };
      this.db.update((d) => d.credentials.push(c));
      return strip(c);
    });
  }

  updateCredential(projectId: number, id: number, input: CredentialInput): Observable<AccessCredential> {
    return mockReply(() => {
      const c = this.cred(projectId, id);
      this.db.update(() => {
        Object.assign(c, { ...input, password: c.password, updatedAt: nowIso(), updatedByName: 'أنت' });
        if (input.password === '') c.password = null;
        else if (input.password) c.password = input.password;
        c.hasPassword = !!c.password;
      });
      return strip(c);
    });
  }

  deleteCredential(projectId: number, id: number): Observable<unknown> {
    return mockReply(() => {
      this.cred(projectId, id);
      this.db.update((d) => (d.credentials = d.credentials.filter((x) => x.id !== id)));
      return null;
    });
  }

  revealCredential(projectId: number, id: number): Observable<{ password: string }> {
    return mockReply(() => {
      const c = this.cred(projectId, id);
      if (!c.password) fail(404, 'no_password', 'No password');
      return { password: c.password };
    }, 350);
  }

  reorderCredentials(projectId: number, ids: number[]): Observable<unknown> {
    return mockReply(() => {
      this.db.update((d) => d.credentials.forEach((c) => c.projectId === projectId && (c.orderIndex = ids.indexOf(c.id))));
      return null;
    });
  }

  releases(projectId: number, query: ReleaseListQuery): Observable<PagedResult<ProjectRelease>> {
    return mockReply(() => {
      this.ensureSeed(projectId);
      const list = this.db
        .get()
        .releases.filter((r) => r.projectId === projectId)
        .filter((r) => !query.platform || r.platform === query.platform)
        .filter((r) => !query.stage || r.stage === query.stage)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return page(list, query.pageIndex ?? 1, query.pageSize ?? 20);
    });
  }

  uploadRelease(projectId: number, input: NewReleaseInput): Observable<UploadEvent<ProjectRelease>> {
    return mockUpload(input.file?.size ?? 0, () => {
      const same = this.db.get().releases.filter((r) => r.projectId === projectId && r.platform === input.platform);
      if (same.some((r) => r.versionName === input.versionName.trim())) fail(409, 'version_exists', 'هذا الإصدار موجود بالفعل لنفس المنصة');
      const release: ProjectRelease = {
        id: this.bump(), projectId, platform: input.platform, versionName: input.versionName.trim(),
        buildNumber: (same.reduce((m, r) => Math.max(m, r.buildNumber), 0) || 0) + 1, stage: input.stage,
        releaseNotes: input.releaseNotes, fileName: input.file?.name ?? null, fileSizeBytes: input.file?.size ?? null,
        fileSha256: null, externalUrl: input.externalUrl, hasFile: !!input.file, apkPackageName: null, apkVersionCode: null,
        isVisibleToClient: input.isVisibleToClient, isLatest: true, uploadedById: null, uploadedByName: 'أنت',
        downloadCount: 0, createdAt: nowIso(),
      };
      this.db.update((d) => {
        d.releases.forEach((r) => r.projectId === projectId && r.platform === input.platform && (r.isLatest = false));
        d.releases.push(release);
      });
      return release;
    });
  }

  updateRelease(projectId: number, id: number, patch: ReleasePatch): Observable<ProjectRelease> {
    return mockReply(() => {
      const r = this.db.get().releases.find((x) => x.id === id && x.projectId === projectId);
      if (!r) fail(404, 'not_found', 'Release not found');
      this.db.update(() => Object.assign(r, patch));
      return r;
    });
  }

  deleteRelease(projectId: number, id: number): Observable<unknown> {
    return mockReply(() => {
      this.db.update((d) => (d.releases = d.releases.filter((x) => !(x.id === id && x.projectId === projectId))));
      return null;
    });
  }

  downloadUrl(): string {
    return '';
  }

  private creds(projectId: number): MockCredential[] {
    this.ensureSeed(projectId);
    return this.db
      .get()
      .credentials.filter((c) => c.projectId === projectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  private cred(projectId: number, id: number): MockCredential {
    const c = this.db.get().credentials.find((x) => x.id === id && x.projectId === projectId);
    if (!c) fail(404, 'not_found', 'Credential not found');
    return c;
  }

  private ensureSeed(projectId: number): void {
    if (this.seeded.has(projectId)) return;
    this.seeded.add(projectId);
    const db = this.db.get();
    if (db.credentials.some((c) => c.projectId === projectId) || db.releases.some((r) => r.projectId === projectId)) return;
    const seed = seedFor(projectId, db.nextId);
    this.db.update((d) => {
      d.credentials.push(...seed.credentials);
      d.releases.push(...seed.releases);
      d.nextId += 2;
    });
  }

  private bump(): number {
    let id = 0;
    this.db.update((d) => (id = d.nextId++));
    return id;
  }
}

function strip(c: MockCredential): AccessCredential {
  const { password, ...rest } = c;
  void password;
  return rest;
}
