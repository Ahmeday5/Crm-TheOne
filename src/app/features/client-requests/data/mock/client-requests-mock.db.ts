import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { fail, nowIso, page } from '../../../../core/mocks/mock-http.util';
import { PagedResult } from '../../../../shared/models';
import {
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  CommentAuthorRole,
  NewRequestInput,
  ProjectSurface,
  RequestAttachment,
  RequestCommentKind,
  RequestOptions,
  RequestPatch,
  RequestStatus,
  TEAM_STATUSES,
  canMoveStatus,
  isAwaitingDecision,
} from '../../../client-portal/models/client-portal.models';
import { awaitingPartyOf, targetProblem } from '../../../client-portal/utils/request-target.util';
import {
  ApproveRequestInput,
  ClassificationPatch,
  InboxQuery,
  InboxSummary,
  RejectRequestInput,
  SurfaceInput,
} from '../../models/client-requests.models';

/**
 * In-memory backend for client requests v3 (`CONTRACT_MOCKS.clientRequestsTriage`).
 *
 * ONE store behind both the portal and the staff adapters, persisted in
 * localStorage and re-read on every access, so the client portal in one tab
 * and the Admin inbox in another act on the same requests — a `storage` event
 * tells the other tab to refresh (`changes$`). Every rule mirrors the contract:
 * the state machine, visibility (developers never see triage statuses, the
 * client never sees internal notes) and the `reason` codes.
 */

const KEY = 'mock.clientRequestsTriage.v1';

/** Who wrote a comment — `client` or a staff user id (drives `isMine`). */
interface StoredComment extends Omit<ClientRequestComment, 'isMine'> {
  authorKey: string;
}

interface StoredRequest extends Omit<ClientRequestDetails, 'comments'> {
  comments: StoredComment[];
  isArchived: boolean;
}

interface StoredSurface extends ProjectSurface {
  projectId: number;
}

interface State {
  requests: StoredRequest[];
  surfaces: StoredSurface[];
  seededProjects: number[];
  nextId: number;
}

export interface StaffActor {
  userId: string;
  name: string;
  role: 'Admin' | 'Developer';
}

export interface ClientActor {
  customerId: number | null;
  customerName: string | null;
  visitorName: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientRequestsMockDb {
  private readonly zone = inject(NgZone);
  private readonly changesSubject = new Subject<number | null>();
  private memory: State | null = null;

  /** A project's requests changed (here or in another tab) — `null` = unknown / many. */
  readonly changes$: Observable<number | null> = this.changesSubject.asObservable();

  constructor() {
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) this.zone.run(() => this.changesSubject.next(null));
      });
    } catch {
      /* no window (SSR / tests) */
    }
  }

  // ═════════════════════ client portal ═════════════════════

  requestOptions(projectId: number): RequestOptions {
    this.ensureProject(projectId);
    const surfaces = this.surfacesOf(projectId).filter((s) => s.isActive);
    return { surfaces, appRequired: surfaces.filter((s) => s.kind === 'MobileApp').length >= 2 };
  }

  clientList(projectId: number, customerId: number | null): ClientRequestListItem[] {
    this.ensureProject(projectId);
    return this.read()
      .requests.filter((r) => r.projectId === projectId && (customerId == null || r.customerId == null || r.customerId === customerId))
      .map((r) => toListItem(this.forClient(r)))
      .sort(clientOrder);
  }

  clientGet(id: number): ClientRequestDetails {
    return this.forClient(this.find(id));
  }

  clientCreate(projectId: number, input: NewRequestInput, actor: ClientActor): ClientRequestDetails {
    const options = this.requestOptions(projectId);
    const problem = targetProblem(input, options);
    if (problem) fail(400, problem, problemMessage(problem));
    const surface = input.surfaceId != null ? options.surfaces.find((s) => s.id === input.surfaceId)! : null;
    const now = nowIso();
    let created!: StoredRequest;
    this.write((d) => {
      const id = d.nextId++;
      created = {
        id,
        projectId,
        projectName: this.projectName(d, projectId),
        type: input.type,
        title: input.title.trim(),
        description: input.description.trim(),
        status: 'PendingReview',
        priority: null,
        clientName: actor.visitorName,
        customerId: actor.customerId,
        customerName: actor.customerName,
        target: surface ? surface.kind : input.target,
        surfaceId: surface?.id ?? null,
        appAudience: surface ? surface.appAudience : input.appAudience,
        appName: input.appName,
        appPlatform: input.appPlatform,
        targetLabel: surface?.name ?? input.appName ?? null,
        surface: surface ? { ...surface } : null,
        awaitingParty: 'Admin',
        clientRepliedAt: null,
        reviewedAt: null,
        reviewedByName: null,
        rejectReasonCode: null,
        rejectReason: null,
        approvedAt: null,
        clarificationRequestedAt: null,
        assignedToId: null,
        assignedToName: null,
        commentsCount: 0,
        attachmentsCount: input.attachments.length,
        attachments: fakeAttachments(input.attachments, id * 100),
        resolvedAt: null,
        createdAt: now,
        updatedAt: null,
        comments: [],
        isArchived: false,
      };
      d.requests.unshift(created);
    }, projectId);
    return this.forClient(created);
  }

  clientComment(id: number, body: string, files: File[]): ClientRequestComment {
    let saved!: StoredComment;
    this.mutate(id, (r) => {
      if (r.status === 'Rejected') fail(409, 'request_rejected', 'This request was declined');
      if (r.status === 'Closed') fail(400, 'request_closed', 'This request is closed');
      const now = nowIso();
      const answering = r.status === 'NeedsClarification';
      saved = this.pushComment(r, {
        kind: answering ? 'ClarificationAnswer' : 'Message',
        authorKey: 'client',
        authorName: r.clientName ?? r.customerName,
        authorRole: 'Client',
        body,
        files,
      });
      if (answering) this.transition(r, 'PendingReview', { key: 'client', name: null, role: 'Client' }, null);
      if (r.status === 'PendingReview') r.clientRepliedAt = now;
      if (r.status === 'Resolved') this.transition(r, 'InReview', { key: 'client', name: null, role: 'Client' }, null);
    });
    return { ...saved, isMine: true };
  }

  // ═════════════════════ staff — one project ═════════════════════

  projectList(projectId: number, status: RequestStatus | null | undefined, actor: StaffActor): ClientRequestListItem[] {
    this.ensureProject(projectId);
    return this.read()
      .requests.filter((r) => r.projectId === projectId)
      .filter((r) => this.staffCanSee(r, actor))
      .filter((r) => (status ? r.status === status : r.status !== 'Rejected'))
      .map((r) => toListItem(this.forStaff(r, actor)))
      .sort(staffOrder);
  }

  staffGet(id: number, actor: StaffActor, projectId?: number): ClientRequestDetails {
    const r = this.find(id);
    if ((projectId != null && r.projectId !== projectId) || !this.staffCanSee(r, actor)) fail(404, 'not_found', 'Request not found');
    return this.forStaff(r, actor);
  }

  patch(projectId: number, id: number, patch: RequestPatch, actor: StaffActor): ClientRequestDetails {
    this.staffGet(id, actor, projectId);
    this.mutate(id, (r) => {
      if (!TEAM_STATUSES.includes(r.status)) fail(409, 'request_not_approved', 'Approve the request first');
      if (patch.status && !TEAM_STATUSES.includes(patch.status)) fail(400, 'use_triage_endpoint', 'Use the triage actions');
      if (patch.status && !canMoveStatus(r.status, patch.status)) fail(409, 'status_cannot_go_back', 'A status cannot go back');
      if (patch.priority) r.priority = patch.priority;
      if (patch.assignedToId !== undefined) {
        r.assignedToId = patch.assignedToId || null;
        r.assignedToName = patch.assignedToId ? 'عضو الفريق' : null;
      }
      if (patch.status && patch.status !== r.status) {
        this.transition(r, patch.status, staffAuthor(actor), null);
        if (patch.status === 'Resolved') r.resolvedAt = nowIso();
      }
      r.updatedAt = nowIso();
    });
    return this.staffGet(id, actor);
  }

  staffComment(id: number, body: string, files: File[], isInternal: boolean, actor: StaffActor): ClientRequestComment {
    this.staffGet(id, actor);
    let saved!: StoredComment;
    this.mutate(id, (r) => {
      if (!isInternal && r.status === 'Rejected') fail(409, 'request_rejected', 'This request was declined');
      saved = this.pushComment(r, {
        kind: isInternal ? 'InternalNote' : 'Message',
        authorKey: actor.userId,
        authorName: actor.name,
        authorRole: actor.role,
        body,
        files,
      });
    });
    return { ...saved, isMine: true };
  }

  // ═════════════════════ Admin inbox ═════════════════════

  inbox(q: InboxQuery, actor: StaffActor): PagedResult<ClientRequestListItem> {
    const term = (q.search ?? '').trim().toLowerCase();
    const rows = this.read()
      .requests.filter((r) => (q.status ? r.status === q.status : r.status !== 'Rejected'))
      .filter((r) => !q.projectId || r.projectId === q.projectId)
      .filter((r) => !q.target || r.target === q.target)
      .filter((r) => !q.type || r.type === q.type)
      .filter(
        (r) =>
          !term ||
          String(r.id) === term.replace('#', '') ||
          [r.title, r.description, r.customerName, r.clientName, r.projectName].some((v) => v?.toLowerCase().includes(term)),
      )
      .map((r) => toListItem(this.forStaff(r, actor)));
    const sort = q.sort ?? (q.status === 'PendingReview' ? 'oldest' : 'newest');
    rows.sort((a, b) => {
      const d = stamp(a) - stamp(b);
      return sort === 'oldest' ? d : -d;
    });
    if (!q.status) rows.sort((a, b) => urgency(a) - urgency(b));
    return page(rows, q.pageIndex ?? 1, q.pageSize ?? 20);
  }

  summary(): InboxSummary {
    const all = this.read().requests;
    const pending = all.filter((r) => r.status === 'PendingReview');
    const monthAgo = Date.now() - 30 * 86_400_000;
    return {
      pendingReview: pending.length,
      clientReplied: pending.filter(clientAnswered).length,
      needsClarification: all.filter((r) => r.status === 'NeedsClarification').length,
      approvedOpen: all.filter((r) => r.status === 'Open' || r.status === 'InReview' || r.status === 'InProgress').length,
      rejectedLast30Days: all.filter((r) => r.status === 'Rejected' && Date.parse(r.reviewedAt ?? r.createdAt) > monthAgo).length,
      oldestPendingAt: pending.map((r) => r.createdAt).sort()[0] ?? null,
    };
  }

  approve(id: number, input: ApproveRequestInput, actor: StaffActor, assigneeName: string | null): ClientRequestDetails {
    this.mutate(id, (r) => {
      this.guardDecision(r);
      const now = nowIso();
      if (input.title?.trim()) r.title = input.title.trim();
      r.priority = input.priority;
      r.assignedToId = input.assignedToId || null;
      r.assignedToName = input.assignedToId ? assigneeName ?? 'عضو الفريق' : null;
      r.approvedAt = now;
      r.reviewedAt = now;
      r.reviewedByName = actor.name;
      this.transition(r, 'Open', staffAuthor(actor), null);
      if (input.internalNote?.trim()) {
        this.pushComment(r, { kind: 'InternalNote', authorKey: actor.userId, authorName: actor.name, authorRole: 'Admin', body: input.internalNote.trim(), files: [] });
      }
    });
    return this.staffGet(id, actor);
  }

  reject(id: number, input: RejectRequestInput, actor: StaffActor): ClientRequestDetails {
    if (input.reasonCode === 'Other' && !input.reason?.trim()) fail(400, 'reason_required', 'Write the reason');
    this.mutate(id, (r) => {
      this.guardDecision(r);
      r.rejectReasonCode = input.reasonCode;
      r.rejectReason = input.reason?.trim() || null;
      r.reviewedAt = nowIso();
      r.reviewedByName = actor.name;
      r.isArchived = true;
      this.transition(r, 'Rejected', staffAuthor(actor), r.rejectReason);
    });
    return this.staffGet(id, actor);
  }

  clarify(id: number, question: string, files: File[], actor: StaffActor): ClientRequestDetails {
    this.mutate(id, (r) => {
      this.guardDecision(r);
      this.pushComment(r, { kind: 'ClarificationQuestion', authorKey: actor.userId, authorName: actor.name, authorRole: 'Admin', body: question.trim(), files });
      r.clarificationRequestedAt = nowIso();
      if (r.status !== 'NeedsClarification') this.transition(r, 'NeedsClarification', staffAuthor(actor), null);
    });
    return this.staffGet(id, actor);
  }

  reopenReview(id: number, actor: StaffActor): ClientRequestDetails {
    this.mutate(id, (r) => {
      if (r.status !== 'Rejected') fail(409, 'invalid_transition', 'Only declined requests can go back to review');
      r.isArchived = false;
      r.rejectReasonCode = null;
      r.rejectReason = null;
      this.transition(r, 'PendingReview', staffAuthor(actor), null);
    });
    return this.staffGet(id, actor);
  }

  classify(id: number, patch: ClassificationPatch, actor: StaffActor): ClientRequestDetails {
    this.mutate(id, (r) => {
      if (r.status === 'Rejected') fail(409, 'invalid_transition', 'Declined');
      const next = {
        target: patch.target ?? r.target,
        surfaceId: patch.surfaceId !== undefined ? patch.surfaceId : r.surfaceId,
        appAudience: patch.appAudience !== undefined ? patch.appAudience : r.appAudience,
        appName: patch.appName !== undefined ? patch.appName : r.appName,
        appPlatform: patch.appPlatform !== undefined ? patch.appPlatform : r.appPlatform,
      };
      const options = this.requestOptions(r.projectId);
      // The Admin may file it under any target; only the shape rules apply.
      const problem = targetProblem(next, { surfaces: options.surfaces, appRequired: false });
      if (problem && problem !== 'app_required') fail(400, problem, problemMessage(problem));
      if (next.target === 'MobileApp' && !next.surfaceId && !next.appAudience) fail(400, 'app_required', problemMessage('app_required'));
      const surface = next.surfaceId != null ? options.surfaces.find((s) => s.id === next.surfaceId) ?? null : null;
      Object.assign(r, next, {
        type: patch.type ?? r.type,
        target: surface?.kind ?? next.target,
        appAudience: surface ? surface.appAudience : next.appAudience,
        surface: surface ? { ...surface } : null,
        targetLabel: surface?.name ?? next.appName ?? null,
      });
      this.transition(r, r.status, staffAuthor(actor), 'classification');
    });
    return this.staffGet(id, actor);
  }

  // ═════════════════════ surfaces ═════════════════════

  surfaces(projectId: number): ProjectSurface[] {
    this.ensureProject(projectId);
    return this.surfacesOf(projectId);
  }

  saveSurface(projectId: number, id: number | null, input: SurfaceInput): ProjectSurface {
    if (input.kind === 'Other') fail(400, 'surface_kind_invalid', 'Pick website, dashboard or app');
    if (input.kind === 'MobileApp' && !input.appAudience) fail(400, 'app_required', 'Pick who uses this app');
    const name = input.name.trim();
    if (!name) fail(400, 'validation', 'Name is required');
    if (this.surfacesOf(projectId).some((s) => s.id !== id && s.name.trim().toLowerCase() === name.toLowerCase())) {
      fail(400, 'surface_name_taken', 'This name is already used in this project');
    }
    let saved!: StoredSurface;
    this.write((d) => {
      const existing = id != null ? d.surfaces.find((s) => s.id === id && s.projectId === projectId) : null;
      if (id != null && !existing) fail(404, 'not_found', 'Surface not found');
      const fields = {
        kind: input.kind,
        appAudience: input.kind === 'MobileApp' ? input.appAudience : null,
        name,
        platforms: input.kind === 'MobileApp' ? input.platforms : null,
        url: input.url?.trim() || null,
        isActive: input.isActive,
      };
      if (existing) {
        Object.assign(existing, fields);
        saved = existing;
      } else {
        const order = d.surfaces.filter((s) => s.projectId === projectId).length;
        saved = { id: d.nextId++, projectId, orderIndex: order, ...fields };
        d.surfaces.push(saved);
      }
    }, projectId);
    return stripProject(saved);
  }

  deleteSurface(projectId: number, id: number): void {
    this.write((d) => {
      const used = d.requests.some((r) => r.surfaceId === id);
      if (used) {
        const s = d.surfaces.find((x) => x.id === id && x.projectId === projectId);
        if (s) s.isActive = false;
      } else {
        d.surfaces = d.surfaces.filter((x) => !(x.id === id && x.projectId === projectId));
      }
    }, projectId);
  }

  reorderSurfaces(projectId: number, ids: number[]): void {
    this.write((d) => {
      for (const s of d.surfaces) {
        if (s.projectId !== projectId) continue;
        const i = ids.indexOf(s.id);
        if (i >= 0) s.orderIndex = i;
      }
    }, projectId);
  }

  // ═════════════════════ projections / rules ═════════════════════

  private forClient(r: StoredRequest): ClientRequestDetails {
    const comments = r.comments
      .filter((c) => c.kind !== 'InternalNote')
      .map(({ authorKey, ...c }) => ({
        ...c,
        isMine: authorKey === 'client',
        authorName: c.kind === 'StatusChange' && c.authorRole !== 'Client' ? null : c.authorName,
      }));
    const { isArchived: _a, ...rest } = r;
    return { ...rest, reviewedByName: null, assignedToId: null, assignedToName: null, comments, commentsCount: comments.filter(countable).length };
  }

  private forStaff(r: StoredRequest, actor: StaffActor): ClientRequestDetails {
    const comments = r.comments.map(({ authorKey, ...c }) => ({ ...c, isMine: authorKey === actor.userId }));
    const { isArchived: _a, ...rest } = r;
    return { ...rest, comments, commentsCount: comments.filter(countable).length };
  }

  private staffCanSee(r: StoredRequest, actor: StaffActor): boolean {
    return actor.role === 'Admin' || TEAM_STATUSES.includes(r.status);
  }

  private guardDecision(r: StoredRequest): void {
    if (!isAwaitingDecision(r.status)) fail(409, 'invalid_transition', `The request is already ${r.status}`);
  }

  private transition(
    r: StoredRequest,
    to: RequestStatus,
    by: { key: string; name: string | null; role: CommentAuthorRole },
    body: string | null,
  ): void {
    const from = r.status;
    r.status = to;
    r.awaitingParty = awaitingPartyOf(to);
    r.updatedAt = nowIso();
    r.comments.push({
      id: uid(),
      kind: 'StatusChange',
      authorKey: by.key,
      authorName: by.name,
      authorRole: by.role,
      body: body ?? '',
      attachments: [],
      statusFrom: from,
      statusTo: to,
      createdAt: nowIso(),
    });
  }

  private pushComment(
    r: StoredRequest,
    c: { kind: RequestCommentKind; authorKey: string; authorName: string | null; authorRole: CommentAuthorRole; body: string; files: File[] },
  ): StoredComment {
    const id = uid();
    const saved: StoredComment = {
      id,
      kind: c.kind,
      authorKey: c.authorKey,
      authorName: c.authorName,
      authorRole: c.authorRole,
      body: c.body.trim(),
      attachments: fakeAttachments(c.files, id),
      statusFrom: null,
      statusTo: null,
      createdAt: nowIso(),
    };
    r.comments.push(saved);
    r.updatedAt = saved.createdAt;
    return saved;
  }

  private find(id: number): StoredRequest {
    const r = this.read().requests.find((x) => x.id === id);
    if (!r) fail(404, 'not_found', 'Request not found');
    return r;
  }

  private mutate(id: number, change: (r: StoredRequest) => void): void {
    const projectId = this.find(id).projectId;
    this.write((d) => {
      const r = d.requests.find((x) => x.id === id);
      if (!r) fail(404, 'not_found', 'Request not found');
      change(r);
      r.commentsCount = r.comments.filter(countable).length;
    }, projectId);
  }

  private surfacesOf(projectId: number): ProjectSurface[] {
    return this.read()
      .surfaces.filter((s) => s.projectId === projectId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(stripProject);
  }

  private projectName(d: State, projectId: number): string | null {
    return d.requests.find((r) => r.projectId === projectId && r.projectName)?.projectName ?? null;
  }

  // ═════════════════════ storage ═════════════════════

  private read(): State {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return (this.memory = JSON.parse(raw) as State);
    } catch {
      /* fall back to memory */
    }
    if (!this.memory) {
      this.memory = seedState();
      this.persist(this.memory);
    }
    return this.memory;
  }

  private write(change: (d: State) => void, projectId: number | null): void {
    const draft = this.read();
    change(draft); // a thrown `ApiError` aborts before anything is saved
    this.memory = draft;
    this.persist(draft);
    queueMicrotask(() => this.changesSubject.next(projectId));
  }

  private persist(state: State): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode / quota — keep it in memory */
    }
  }

  /** Real projects get a few sample requests + surfaces the first time they are opened. */
  private ensureProject(projectId: number): void {
    if (this.read().seededProjects.includes(projectId)) return;
    const draft = this.read();
    draft.seededProjects.push(projectId);
    seedProject(draft, projectId, null);
    this.memory = draft;
    this.persist(draft);
  }
}

// ═════════════════════ helpers ═════════════════════

let seq = 0;
/** Unique comment / attachment id (comments never need the shared counter). */
function uid(): number {
  return (Date.now() % 1_000_000_000) * 100 + (seq++ % 100);
}

function staffAuthor(a: StaffActor): { key: string; name: string; role: CommentAuthorRole } {
  return { key: a.userId, name: a.name, role: a.role };
}

/** `commentsCount` = conversation messages only (no status markers, no internal notes). */
function countable(c: { kind: RequestCommentKind }): boolean {
  return c.kind !== 'StatusChange' && c.kind !== 'InternalNote';
}

function clientAnswered(r: StoredRequest): boolean {
  return !!r.clientRepliedAt && (!r.clarificationRequestedAt || r.clientRepliedAt > r.clarificationRequestedAt);
}

function stamp(r: ClientRequestListItem): number {
  return Date.parse(r.updatedAt ?? r.createdAt);
}

/** "All" view: what needs the Admin first. */
function urgency(r: ClientRequestListItem): number {
  return r.status === 'PendingReview' ? 0 : r.status === 'NeedsClarification' ? 1 : 2;
}

function clientOrder(a: ClientRequestListItem, b: ClientRequestListItem): number {
  const na = a.status === 'NeedsClarification' ? 0 : 1;
  const nb = b.status === 'NeedsClarification' ? 0 : 1;
  return na - nb || stamp(b) - stamp(a);
}

function staffOrder(a: ClientRequestListItem, b: ClientRequestListItem): number {
  return urgency(a) - urgency(b) || stamp(b) - stamp(a);
}

function toListItem(r: ClientRequestDetails): ClientRequestListItem {
  const {
    description: _d,
    resolvedAt: _r,
    reviewedByName: _rb,
    approvedAt: _ap,
    clarificationRequestedAt: _cr,
    surface: _s,
    attachments: _at,
    comments: _c,
    ...item
  } = r;
  return item;
}

function stripProject(s: StoredSurface): ProjectSurface {
  const { projectId: _p, ...rest } = s;
  return { ...rest };
}

function fakeAttachments(files: File[], seed: number): RequestAttachment[] {
  return files.map((f, i) => ({
    id: seed + i,
    fileUrl: f.type.startsWith('image/') ? `https://picsum.photos/seed/${seed + i}/640/400` : '#',
    fileName: f.name,
    contentType: f.type || null,
    sizeBytes: f.size,
  }));
}

function problemMessage(p: string): string {
  switch (p) {
    case 'target_required': return 'Choose what the request is about';
    case 'app_required': return 'Choose which app';
    case 'app_name_required': return 'Write the app name';
    case 'surface_invalid': return 'This part of the project is not available';
    default: return p;
  }
}

// ═════════════════════ seed ═════════════════════

function ago(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function seedState(): State {
  const state: State = { requests: [], surfaces: [], seededProjects: [], nextId: 5000 };
  seedProject(state, 9001, 'فريش ماركت — منصة التوصيل');
  seedProject(state, 9002, 'عيادات شفاء');
  state.seededProjects.push(9001, 9002);
  return state;
}

function seedProject(d: State, projectId: number, name: string | null): void {
  const projectName = name ?? `مشروع #${projectId}`;
  const sid = () => d.nextId++;
  const customerApp: StoredSurface = { id: sid(), projectId, kind: 'MobileApp', appAudience: 'Customer', name: 'تطبيق العميل', platforms: 'Both', url: null, orderIndex: 0, isActive: true };
  const driverApp: StoredSurface = { id: sid(), projectId, kind: 'MobileApp', appAudience: 'Driver', name: 'تطبيق المندوب', platforms: 'Android', url: null, orderIndex: 1, isActive: true };
  const dashboard: StoredSurface = { id: sid(), projectId, kind: 'Dashboard', appAudience: null, name: 'لوحة التحكم', platforms: null, url: 'https://admin.example.com', orderIndex: 2, isActive: true };
  const website: StoredSurface = { id: sid(), projectId, kind: 'Website', appAudience: null, name: 'الموقع التعريفي', platforms: null, url: 'https://example.com', orderIndex: 3, isActive: true };
  d.surfaces.push(customerApp, driverApp, dashboard, website);

  const base = (over: Partial<StoredRequest>): StoredRequest => ({
    id: d.nextId++,
    projectId,
    projectName,
    type: 'Issue',
    title: '',
    description: '',
    status: 'PendingReview',
    priority: null,
    clientName: 'أ. محمود',
    customerId: null,
    customerName: name ? projectName.split(' — ')[0] : 'العميل',
    target: 'MobileApp',
    surfaceId: null,
    appAudience: null,
    appName: null,
    appPlatform: null,
    targetLabel: null,
    surface: null,
    awaitingParty: 'Admin',
    clientRepliedAt: null,
    reviewedAt: null,
    reviewedByName: null,
    rejectReasonCode: null,
    rejectReason: null,
    approvedAt: null,
    clarificationRequestedAt: null,
    assignedToId: null,
    assignedToName: null,
    commentsCount: 0,
    attachmentsCount: 0,
    attachments: [],
    resolvedAt: null,
    createdAt: ago(5),
    updatedAt: null,
    comments: [],
    isArchived: false,
    ...over,
  });
  const onSurface = (s: StoredSurface) => ({
    target: s.kind,
    surfaceId: s.id,
    appAudience: s.appAudience,
    targetLabel: s.name,
    surface: stripProject(s),
  });
  const sc = (from: RequestStatus, to: RequestStatus, hoursAgo: number, role: CommentAuthorRole = 'Admin'): StoredComment => ({
    id: d.nextId++, kind: 'StatusChange', authorKey: role === 'Client' ? 'client' : 'mock-admin', authorName: role === 'Client' ? null : 'الإدارة',
    authorRole: role, body: '', attachments: [], statusFrom: from, statusTo: to, createdAt: ago(hoursAgo),
  });
  const msg = (kind: RequestCommentKind, role: CommentAuthorRole, body: string, hoursAgo: number): StoredComment => ({
    id: d.nextId++, kind, authorKey: role === 'Client' ? 'client' : 'mock-admin', authorName: role === 'Client' ? 'أ. محمود' : 'الإدارة',
    authorRole: role, body, attachments: [], statusFrom: null, statusTo: null, createdAt: ago(hoursAgo),
  });

  d.requests.push(
    base({
      ...onSurface(driverApp),
      appPlatform: 'Android',
      title: 'التطبيق بيقفل لما المندوب يقبل الطلب',
      description: 'من امبارح أي مندوب يدوس "قبول الطلب" التطبيق يقفل لوحده. حصل مع 3 مناديب على أندرويد.',
      createdAt: ago(3),
    }),
    base({
      ...onSurface(dashboard),
      type: 'ChangeRequest',
      title: 'إضافة فلتر بالتاريخ في تقرير المبيعات',
      description: 'محتاجين نفلتر تقرير المبيعات من تاريخ لتاريخ ونصدّره Excel.',
      createdAt: ago(30),
      clarificationRequestedAt: ago(26),
      clientRepliedAt: ago(2),
      updatedAt: ago(2),
      comments: [
        msg('ClarificationQuestion', 'Admin', 'التصدير يكون لكل الفروع مع بعض ولا كل فرع لوحده؟', 26),
        sc('PendingReview', 'NeedsClarification', 26),
        msg('ClarificationAnswer', 'Client', 'كل فرع لوحده، ويبقى فيه اختيار "كل الفروع" كمان.', 2),
        sc('NeedsClarification', 'PendingReview', 2, 'Client'),
      ],
    }),
    base({
      ...onSurface(customerApp),
      type: 'ChangeRequest',
      title: 'تغيير لون زرار "اطلب الآن"',
      description: 'عايزين اللون يبقى زي لون اللوجو الجديد.',
      status: 'NeedsClarification',
      awaitingParty: 'Client',
      createdAt: ago(20),
      clarificationRequestedAt: ago(18),
      updatedAt: ago(18),
      comments: [
        msg('ClarificationQuestion', 'Admin', 'ممكن تبعتلنا كود اللون أو ملف اللوجو الجديد؟', 18),
        sc('PendingReview', 'NeedsClarification', 18),
      ],
    }),
    base({
      ...onSurface(customerApp),
      title: 'الإشعارات مش بتوصل على الآيفون',
      description: 'العملاء اللي عندهم آيفون مش بيوصلهم إشعار تأكيد الطلب.',
      appPlatform: 'iOS',
      status: 'InProgress',
      awaitingParty: 'Team',
      priority: 'High',
      approvedAt: ago(40),
      reviewedAt: ago(40),
      reviewedByName: 'الإدارة',
      createdAt: ago(48),
      updatedAt: ago(10),
      comments: [sc('PendingReview', 'Open', 40), sc('Open', 'InProgress', 10, 'Developer')],
    }),
    base({
      target: 'Website',
      type: 'ChangeRequest',
      title: 'متجر إلكتروني كامل على الموقع',
      description: 'عايزين نضيف متجر كامل بالدفع أونلاين على الموقع التعريفي.',
      status: 'Rejected',
      awaitingParty: null,
      rejectReasonCode: 'NeedsNewQuote',
      rejectReason: 'ده نطاق جديد خارج التعاقد الحالي — مدير المشروع هيتواصل معاك بعرض سعر.',
      reviewedAt: ago(70),
      reviewedByName: 'الإدارة',
      isArchived: true,
      createdAt: ago(72),
      updatedAt: ago(70),
      comments: [{ ...sc('PendingReview', 'Rejected', 70), body: 'ده نطاق جديد خارج التعاقد الحالي — مدير المشروع هيتواصل معاك بعرض سعر.' }],
    }),
  );
  for (const r of d.requests) r.commentsCount = r.comments.filter(countable).length;
}
