import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  ClientProjectDetail,
  ClientProjectSummary,
  ClientRequest,
  NewRequestDraft,
  RequestAttachment,
  RequestComment,
  RequestPatch,
  TimelineEvent,
} from '../models/client-portal.models';
import { ClientPortalGateway } from './client-portal-gateway';
import { mockId, seedClientProjects, seedComments, seedRequests, seedTimeline } from './mock-client-portal.seed';

/** Simulated network latency for writes. */
const WRITE_MS = 450;

/**
 * Module-level store: survives page changes for the whole session, so a
 * request raised on one page shows on the next (and in the staff workspace).
 */
const projects = new BehaviorSubject<ClientProjectDetail[]>(seedClientProjects());
const requestsByProject = new Map<number, BehaviorSubject<ClientRequest[]>>();
const commentsByRequest = new Map<string, BehaviorSubject<RequestComment[]>>();

/**
 * TEMPORARY in-memory adapter — preview only, nothing leaves the browser.
 * Provided at the routes (see `provideClientPortalGateway()`).
 */
@Injectable()
export class MockClientPortalGateway extends ClientPortalGateway {
  private readonly auth = inject(AuthService);

  myProjects$(): Observable<ClientProjectSummary[]> {
    return projects.pipe(
      map((list) => list.map((p) => ({ ...p, openRequests: this.openCount(p.projectId, p.name) }))),
    );
  }

  project$(projectId: number): Observable<ClientProjectDetail | null> {
    return projects.pipe(map((list) => list.find((p) => p.projectId === projectId) ?? null));
  }

  timeline$(projectId: number): Observable<TimelineEvent[]> {
    return of(seedTimeline(projectId));
  }

  requests$(projectId: number): Observable<ClientRequest[]> {
    return this.requestsSubject(projectId).pipe(
      map((list) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    );
  }

  comments$(requestId: string): Observable<RequestComment[]> {
    return this.commentsSubject(requestId).asObservable();
  }

  createRequest(draft: NewRequestDraft): Observable<ClientRequest> {
    const now = new Date().toISOString();
    const subject = this.requestsSubject(draft.projectId);
    const request: ClientRequest = {
      id: mockId('req'),
      projectId: draft.projectId,
      projectName: projects.value.find((p) => p.projectId === draft.projectId)?.name ?? `#${draft.projectId}`,
      type: draft.type,
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: 'Open',
      priority: null,
      attachments: draft.files.map(toAttachment),
      createdByName: this.myName(),
      createdAt: now,
      updatedAt: now,
      commentsCount: 0,
    };
    commentsByRequest.set(request.id, new BehaviorSubject<RequestComment[]>([]));
    subject.next([request, ...subject.value]);
    return of(request).pipe(delay(WRITE_MS));
  }

  addComment(requestId: string, body: string, files: File[]): Observable<RequestComment> {
    const isClient = this.auth.currentRole() === 'Client';
    const comment: RequestComment = {
      id: mockId('cm'),
      requestId,
      authorName: this.myName(),
      authorRole: isClient ? 'Client' : 'Staff',
      body: body.trim(),
      attachments: files.map(toAttachment),
      createdAt: new Date().toISOString(),
    };
    const subject = this.commentsSubject(requestId);
    subject.next([...subject.value, comment]);
    this.patchRequest(requestId, (r) => ({ ...r, commentsCount: r.commentsCount + 1, updatedAt: comment.createdAt }));
    return of(comment).pipe(delay(WRITE_MS));
  }

  updateRequest(requestId: string, patch: RequestPatch): Observable<ClientRequest> {
    const updated = this.patchRequest(requestId, (r) => ({ ...r, ...patch, updatedAt: new Date().toISOString() }));
    return of(updated!).pipe(delay(WRITE_MS));
  }

  // ── internals ──

  private myName(): string {
    const u = this.auth.currentUser();
    return u?.fullName || u?.email?.split('@')[0] || 'أنا';
  }

  private openCount(projectId: number, name: string): number {
    return this.requestsSubject(projectId, name).value.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed').length;
  }

  private requestsSubject(projectId: number, name?: string): BehaviorSubject<ClientRequest[]> {
    let s = requestsByProject.get(projectId);
    if (!s) {
      const projectName = name ?? projects.value.find((p) => p.projectId === projectId)?.name ?? `#${projectId}`;
      s = new BehaviorSubject<ClientRequest[]>(seedRequests(projectId, projectName));
      requestsByProject.set(projectId, s);
    }
    return s;
  }

  private commentsSubject(requestId: string): BehaviorSubject<RequestComment[]> {
    let s = commentsByRequest.get(requestId);
    if (!s) {
      s = new BehaviorSubject<RequestComment[]>(seedComments(requestId));
      commentsByRequest.set(requestId, s);
    }
    return s;
  }

  /** Apply `fn` to the request wherever it lives; returns the updated row. */
  private patchRequest(requestId: string, fn: (r: ClientRequest) => ClientRequest): ClientRequest | null {
    for (const subject of requestsByProject.values()) {
      const hit = subject.value.find((r) => r.id === requestId);
      if (hit) {
        const next = fn(hit);
        subject.next(subject.value.map((r) => (r.id === requestId ? next : r)));
        return next;
      }
    }
    return null;
  }
}

function toAttachment(file: File): RequestAttachment {
  return { name: file.name, sizeBytes: file.size, url: null };
}
