import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { withCacheInvalidate, withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { MockStore, daysFromNow, fail, mockReply, nowIso, page, randomToken } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  ClientPortalLink,
  CreateLinkInput,
  LinkAccessLogEntry,
  ProjectClientLink,
  UpdateLinkInput,
} from '../models/client-link.models';

/** The admin side of the customer's private portal link. */
export interface ClientLinkGateway {
  forProject(projectId: number): Observable<ProjectClientLink>;
  /** Creates the customer's link (revokes any active one). The response carries the full `url` once. */
  createForProject(projectId: number, input: CreateLinkInput): Observable<ClientPortalLink>;
  update(linkId: number, input: UpdateLinkInput): Observable<ClientPortalLink>;
  /** Full URL again (audited). */
  reveal(linkId: number): Observable<{ url: string }>;
  regenerate(linkId: number): Observable<ClientPortalLink>;
  revoke(linkId: number): Observable<unknown>;
  accessLog(linkId: number, pageIndex: number, pageSize: number): Observable<PagedResult<LinkAccessLogEntry>>;
}

const PROJECT_CACHE = ['Projects', 'ClientPortalLinks'];

@Injectable({ providedIn: 'root' })
export class HttpClientLinkGateway implements ClientLinkGateway {
  private readonly api = inject(ApiService);

  forProject(projectId: number): Observable<ProjectClientLink> {
    return this.api.get<ProjectClientLink>(API_ENDPOINTS.managerProjects.clientLink(projectId), { context: withSkipLoader() });
  }

  createForProject(projectId: number, input: CreateLinkInput): Observable<ClientPortalLink> {
    return this.api.post<ClientPortalLink>(API_ENDPOINTS.managerProjects.clientLink(projectId), input, {
      context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)),
    });
  }

  update(linkId: number, input: UpdateLinkInput): Observable<ClientPortalLink> {
    return this.api.patch<ClientPortalLink>(API_ENDPOINTS.clientPortalLinks.byId(linkId), input, { context: withInlineHandling() });
  }

  reveal(linkId: number): Observable<{ url: string }> {
    return this.api.post<{ url: string }>(API_ENDPOINTS.clientPortalLinks.reveal(linkId), {}, { context: withInlineHandling() });
  }

  regenerate(linkId: number): Observable<ClientPortalLink> {
    return this.api.post<ClientPortalLink>(API_ENDPOINTS.clientPortalLinks.regenerate(linkId), {}, { context: withInlineHandling() });
  }

  revoke(linkId: number): Observable<unknown> {
    return this.api.delete(API_ENDPOINTS.clientPortalLinks.byId(linkId), {
      context: withInlineHandling(withCacheInvalidate(PROJECT_CACHE)),
    });
  }

  accessLog(linkId: number, pageIndex: number, pageSize: number): Observable<PagedResult<LinkAccessLogEntry>> {
    return this.api.get<PagedResult<LinkAccessLogEntry>>(API_ENDPOINTS.clientPortalLinks.accessLog(linkId), {
      params: { pageIndex, pageSize },
      context: withSkipLoader(),
    });
  }
}

// ─────────── mock ───────────

interface MockLink extends ClientPortalLink {
  token: string;
  projectId: number;
}

interface LinkDb {
  links: MockLink[];
  nextId: number;
}

/**
 * In-memory links keyed by the project they were made from. The URLs point at
 * this app's `/p/:token`, so "Open" really opens the (mock) portal.
 */
@Injectable({ providedIn: 'root' })
export class MockClientLinkGateway implements ClientLinkGateway {
  private readonly db = new MockStore<LinkDb>('crm_mock_client_links_v2', () => ({ links: [], nextId: 1 }));

  forProject(projectId: number): Observable<ProjectClientLink> {
    return mockReply(() => {
      const link = this.active(projectId);
      return {
        hasLink: !!link,
        link: link ? { ...this.view(link), includesThisProject: true } : null,
        customer: { id: 12, name: 'احمد علي', companyName: 'شركة المستقبل', phone: '+201000000000', email: null },
      };
    });
  }

  createForProject(projectId: number, input: CreateLinkInput): Observable<ClientPortalLink> {
    return mockReply(() => {
      this.db.update((d) => d.links.filter((l) => l.projectId === projectId && l.isActive).forEach((l) => (l.isActive = false)));
      const token = randomToken();
      const link: MockLink = {
        id: this.bump(),
        projectId,
        token,
        customerId: 12,
        customerName: 'احمد علي',
        url: null,
        urlMasked: '',
        tokenHint: token.slice(-4),
        label: input.label ?? null,
        scope: input.scope,
        projectIds: input.projectIds ?? [],
        expiresAt: input.expiresAt ?? null,
        hasPin: !!input.pin,
        isActive: true,
        createdAt: nowIso(),
        createdByName: 'Admin',
        lastUsedAt: null,
        useCount: 0,
      };
      this.db.update((d) => d.links.unshift(link));
      return { ...this.view(link), url: urlFor(token) };
    }, 600);
  }

  update(linkId: number, input: UpdateLinkInput): Observable<ClientPortalLink> {
    return mockReply(() => {
      const link = this.find(linkId);
      this.db.update(() => {
        if (input.label !== undefined) link.label = input.label;
        if (input.scope) link.scope = input.scope;
        if (input.projectIds) link.projectIds = input.projectIds;
        if (input.expiresAt !== undefined) link.expiresAt = input.expiresAt;
        if (input.pin !== undefined) link.hasPin = input.pin !== '';
      });
      return this.view(link);
    });
  }

  reveal(linkId: number): Observable<{ url: string }> {
    return mockReply(() => ({ url: urlFor(this.find(linkId).token) }), 300);
  }

  regenerate(linkId: number): Observable<ClientPortalLink> {
    return mockReply(() => {
      const old = this.find(linkId);
      const token = randomToken();
      const fresh: MockLink = { ...old, id: this.bump(), token, tokenHint: token.slice(-4), createdAt: nowIso(), lastUsedAt: null, useCount: 0, isActive: true };
      this.db.update((d) => {
        old.isActive = false;
        d.links.unshift(fresh);
      });
      return { ...this.view(fresh), url: urlFor(token) };
    }, 600);
  }

  revoke(linkId: number): Observable<unknown> {
    return mockReply(() => {
      const link = this.find(linkId);
      this.db.update(() => (link.isActive = false));
      return null;
    });
  }

  accessLog(linkId: number, pageIndex: number, pageSize: number): Observable<PagedResult<LinkAccessLogEntry>> {
    return mockReply(() => {
      this.find(linkId);
      const entries: LinkAccessLogEntry[] = [
        { id: 4, at: daysFromNow(-0.05), event: 'ApkDownloaded', ip: '41.233.10.5', userAgent: 'Android 14 · Chrome', visitorName: 'محمد', projectId: null, projectName: 'crm', reason: null },
        { id: 3, at: daysFromNow(-0.06), event: 'SessionStarted', ip: '41.233.10.5', userAgent: 'Android 14 · Chrome', visitorName: 'محمد', projectId: null, projectName: null, reason: null },
        { id: 2, at: daysFromNow(-1.2), event: 'CredentialRevealed', ip: '197.45.1.20', userAgent: 'Windows · Edge', visitorName: null, projectId: null, projectName: 'crm', reason: null },
        { id: 1, at: daysFromNow(-1.25), event: 'SessionStarted', ip: '197.45.1.20', userAgent: 'Windows · Edge', visitorName: null, projectId: null, projectName: null, reason: null },
      ];
      return page(entries, pageIndex, pageSize);
    });
  }

  private active(projectId: number): MockLink | null {
    return this.db.get().links.find((l) => l.projectId === projectId && l.isActive) ?? null;
  }

  private find(id: number): MockLink {
    const l = this.db.get().links.find((x) => x.id === id);
    if (!l) fail(404, 'not_found', 'Link not found');
    return l;
  }

  private bump(): number {
    let id = 0;
    this.db.update((d) => (id = d.nextId++));
    return id;
  }

  private view(l: MockLink): ClientPortalLink {
    const { token, projectId, ...rest } = l;
    void projectId;
    return { ...rest, url: null, urlMasked: `${location.origin}/p/••••${token.slice(-4)}`, tokenHint: token.slice(-4) };
  }
}

function urlFor(token: string): string {
  return `${location.origin}/p/${token}`;
}

export const CLIENT_LINK_GATEWAY = new InjectionToken<ClientLinkGateway>('CLIENT_LINK_GATEWAY', {
  providedIn: 'root',
  factory: () => (isMocked('clientLinks') ? inject(MockClientLinkGateway) : inject(HttpClientLinkGateway)),
});
