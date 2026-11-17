import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MockStore,
  daysFromNow,
  fail,
  mockReply,
  nowIso,
  page,
  randomToken,
} from '../../../core/mocks/mock-http.util';
import { PagedResult } from '../../../shared/models';
import {
  ClientCredential,
  ClientMilestone,
  ClientProject,
  ClientProjectDetails,
  ClientRelease,
  ClientRequestComment,
  ClientRequestDetails,
  ClientRequestListItem,
  DownloadLink,
  NewRequestInput,
  PortalBranding,
  PortalMe,
  ProgressPoint,
  ProgressRange,
  RequestListQuery,
  TimelineEvent,
} from '../models/client-portal.models';
import { PortalSessionRequest, PortalSessionResponse } from '../models/portal-session.models';
import { ClientPortalGateway } from './client-portal.gateway';

/**
 * In-memory `ClientPortal/*` for building the portal before the backend ships.
 *
 * Try every link state from the address bar:
 *   /p/<anything>   → a working demo session
 *   /p/revoked      → link_revoked        /p/expired → link_expired
 *   /p/invalid      → link_invalid        /p/pin     → PIN pad (PIN 1234)
 *   /p/busy         → 429 with a countdown
 */

interface DemoProject {
  details: ClientProjectDetails;
  credentials: (ClientCredential & { password: string | null })[];
  releases: ClientRelease[];
  timeline: TimelineEvent[];
}

interface PortalDb {
  visitorName: string | null;
  projects: DemoProject[];
  requests: ClientRequestDetails[];
  nextId: number;
}

const CUSTOMER = { id: 12, name: 'احمد علي', companyName: 'شركة المستقبل', logoUrl: null };

const BRANDING: PortalBranding = {
  companyName: 'TheOne',
  tagline: 'نبني أنظمتك باحتراف',
  logoUrl: '/assets/img/logo.png',
  logoDarkUrl: null,
  logoMarkUrl: null,
  primaryColor: null,
  website: 'https://theonesystemco.com',
  supportPhone: '+201000000000',
  supportWhatsApp: '+201000000000',
  supportEmail: 'support@example.com',
  workingHours: 'السبت – الخميس · 9:00 – 17:00',
  socials: [
    { kind: 'Facebook', url: 'https://facebook.com' },
    { kind: 'LinkedIn', url: 'https://linkedin.com' },
  ],
};

function milestone(id: number, title: string, status: ClientMilestone['status'], due: number, order: number): ClientMilestone {
  return {
    id,
    title,
    description: null,
    status,
    dueDate: daysFromNow(due),
    completedAt: status === 'Done' ? daysFromNow(due - 2) : null,
    orderIndex: order,
  };
}

function seed(): PortalDb {
  const crm: DemoProject = {
    details: {
      projectId: 1001,
      name: 'crm',
      shortDescription: 'نظام إدارة علاقات العملاء',
      description: 'نظام CRM متكامل لإدارة العملاء والمبيعات والدعم الفني، مع لوحة تحكم وتطبيق موبايل للمناديب.',
      status: 'InProgress',
      progressPercent: 41.5,
      progressSource: 'Team',
      startDate: daysFromNow(-34),
      expectedEndDate: daysFromNow(23),
      daysRemaining: 23,
      scheduleHealth: 'OnTrack',
      nextMilestone: { title: 'تطبيق الموبايل — النسخة التجريبية', dueDate: daysFromNow(6) },
      latestRelease: { platform: 'Android', versionName: '1.3.0', createdAt: daysFromNow(-1) },
      openRequestsCount: 1,
      lastUpdateAt: daysFromNow(-0.2),
      milestones: [
        milestone(1, 'تحليل المتطلبات والتصميم', 'Done', -28, 0),
        milestone(2, 'لوحة التحكم — الإصدار الأول', 'Done', -9, 1),
        milestone(3, 'تطبيق الموبايل — النسخة التجريبية', 'InProgress', 6, 2),
        milestone(4, 'الربط مع بوابات الدفع', 'Pending', 14, 3),
        milestone(5, 'الاختبار والتسليم النهائي', 'Pending', 23, 4),
      ],
      team: [
        { name: 'abdallah', roleOnProject: 'Backend', avatarUrl: null },
        { name: 'Ahmed', roleOnProject: 'Frontend', avatarUrl: null },
        { name: 'ali', roleOnProject: 'Mobile', avatarUrl: null },
      ],
      counts: { releases: 3, credentials: 2, openRequests: 1, resolvedRequests: 2 },
      projectManager: { name: 'م. محمود حسن', avatarUrl: null, whatsApp: '+201000000000' },
    },
    credentials: [
      {
        id: 1, title: 'لوحة التحكم', kind: 'WebDashboard', environment: 'Staging',
        url: 'https://demo.theonesystemco.com/admin', username: 'client@demo.com', hasPassword: true,
        password: 'Demo@2026', notes: 'نسخة تجريبية — البيانات الموجودة للتجربة فقط.', orderIndex: 0, updatedAt: daysFromNow(-1),
      },
      {
        id: 2, title: 'الموقع التعريفي', kind: 'Website', environment: 'Staging',
        url: 'https://demo.theonesystemco.com', username: null, hasPassword: false,
        password: null, notes: null, orderIndex: 1, updatedAt: daysFromNow(-4),
      },
    ],
    releases: [
      {
        id: 31, platform: 'Android', versionName: '1.3.0', buildNumber: 7, stage: 'Beta',
        releaseNotes: 'شاشة الطلبات الجديدة\nإشعارات فورية عند الرد على طلبك\nتحسين سرعة تسجيل الدخول',
        fileName: 'crm-1.3.0.apk', fileSizeBytes: 38_412_288, externalUrl: null, hasFile: true, isLatest: true,
        createdAt: daysFromNow(-1),
      },
      {
        id: 30, platform: 'Android', versionName: '1.2.1', buildNumber: 6, stage: 'Beta',
        releaseNotes: 'إصلاح مشكلة الصور في الطلبات', fileName: 'crm-1.2.1.apk', fileSizeBytes: 37_120_000,
        externalUrl: null, hasFile: true, isLatest: false, createdAt: daysFromNow(-8),
      },
      {
        id: 29, platform: 'iOS', versionName: '1.2.0', buildNumber: 3, stage: 'Internal',
        releaseNotes: 'أول نسخة iOS للتجربة عبر TestFlight', fileName: null, fileSizeBytes: null,
        externalUrl: 'https://testflight.apple.com', hasFile: false, isLatest: true, createdAt: daysFromNow(-10),
      },
    ],
    timeline: [
      { id: 9, type: 'ReleasePublished', title: 'نسخة Android 1.3.0 متاحة للتحميل', description: null, createdAt: daysFromNow(-1), isClientVisible: null },
      { id: 8, type: 'MilestoneCompleted', title: 'تم إنجاز: لوحة التحكم — الإصدار الأول', description: null, createdAt: daysFromNow(-9), isClientVisible: null },
      { id: 7, type: 'CredentialAdded', title: 'تمت إضافة بيانات دخول: لوحة التحكم', description: null, createdAt: daysFromNow(-9), isClientVisible: null },
      { id: 6, type: 'RequestStatusChanged', title: 'تم حل طلبك: تعديل ألوان الشعار', description: null, createdAt: daysFromNow(-12), isClientVisible: null },
      { id: 5, type: 'MilestoneCompleted', title: 'تم إنجاز: تحليل المتطلبات والتصميم', description: null, createdAt: daysFromNow(-28), isClientVisible: null },
      { id: 4, type: 'StatusChanged', title: 'بدأ العمل على المشروع', description: null, createdAt: daysFromNow(-34), isClientVisible: null },
    ],
  };

  const dev: DemoProject = {
    details: {
      projectId: 1002,
      name: 'تطوير',
      shortDescription: 'تطوير الموقع الإلكتروني',
      description: 'إعادة تصميم وتطوير الموقع الإلكتروني للشركة مع لوحة تحكم للمحتوى.',
      status: 'Planned',
      progressPercent: 0,
      progressSource: 'None',
      startDate: daysFromNow(5),
      expectedEndDate: daysFromNow(60),
      daysRemaining: 60,
      scheduleHealth: 'OnTrack',
      nextMilestone: { title: 'اجتماع البداية', dueDate: daysFromNow(5) },
      latestRelease: null,
      openRequestsCount: 0,
      lastUpdateAt: daysFromNow(-3),
      milestones: [
        milestone(11, 'اجتماع البداية', 'Pending', 5, 0),
        milestone(12, 'التصميم', 'Pending', 20, 1),
        milestone(13, 'التطوير', 'Pending', 50, 2),
      ],
      team: null,
      counts: { releases: 0, credentials: 0, openRequests: 0, resolvedRequests: 0 },
      projectManager: null,
    },
    credentials: [],
    releases: [],
    timeline: [{ id: 21, type: 'MilestoneAdded', title: 'تمت إضافة خطة المشروع', description: null, createdAt: daysFromNow(-3), isClientVisible: null }],
  };

  const request: ClientRequestDetails = {
    id: 501, projectId: 1001, projectName: 'crm', type: 'ChangeRequest', title: 'إضافة تقرير شهري للمبيعات',
    status: 'InProgress', priority: 'Medium', clientName: CUSTOMER.name, assignedToId: null, assignedToName: null,
    commentsCount: 1, attachmentsCount: 0, createdAt: daysFromNow(-3), updatedAt: daysFromNow(-1),
    description: 'محتاجين تقرير شهري يوضح المبيعات لكل مندوب مع إمكانية التصدير Excel.',
    resolvedAt: null, attachments: [],
    comments: [
      { id: 1, authorName: 'فريق TheOne', authorRole: 'Admin', isMine: false, body: 'تمام، بدأنا نشتغل عليه وهيكون جاهز مع النسخة الجاية.', attachments: [], createdAt: daysFromNow(-1) },
    ],
  };

  return { visitorName: null, projects: [crm, dev], requests: [request], nextId: 1000 };
}

@Injectable({ providedIn: 'root' })
export class MockClientPortalGateway implements ClientPortalGateway {
  private readonly db = new MockStore<PortalDb>('crm_mock_portal_v2', seed);

  startSession(request: PortalSessionRequest): Observable<PortalSessionResponse> {
    return mockReply(() => {
      const token = request.token.trim().toLowerCase();
      if (token === 'invalid') fail(404, 'link_invalid', 'Link not found');
      if (token === 'revoked') fail(410, 'link_revoked', 'Link revoked');
      if (token === 'expired') fail(410, 'link_expired', 'Link expired');
      if (token === 'inactive') fail(403, 'customer_inactive', 'Customer inactive');
      if (token === 'busy') fail(429, 'rate_limited', 'Too many requests', 45);
      if (token === 'pin') {
        if (!request.pin) fail(401, 'pin_required', 'PIN required');
        if (request.pin !== '1234') fail(401, 'pin_invalid', 'Wrong PIN');
      }
      if (request.visitorName) this.db.update((d) => (d.visitorName = request.visitorName));
      return {
        accessToken: `mock.${randomToken(24)}`,
        expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
        customer: CUSTOMER,
        visitorName: request.visitorName ?? this.db.get().visitorName,
        projectsCount: this.db.get().projects.length,
      };
    }, 700);
  }

  branding(): Observable<PortalBranding> {
    return mockReply(() => BRANDING, 150);
  }

  me(): Observable<PortalMe> {
    return mockReply(() => ({
      customer: CUSTOMER,
      visitorName: this.db.get().visitorName,
      link: { label: null, expiresAt: null },
      projectsCount: this.db.get().projects.length,
    }));
  }

  myProjects(): Observable<ClientProject[]> {
    return mockReply(() =>
      this.db.get().projects.map(({ details }) => {
        const { description, milestones, team, counts, projectManager, ...card } = details;
        void description; void milestones; void team; void counts; void projectManager;
        return card;
      }),
    );
  }

  project(projectId: number): Observable<ClientProjectDetails> {
    return mockReply(() => this.find(projectId).details);
  }

  progressHistory(projectId: number, range: ProgressRange): Observable<ProgressPoint[]> {
    return mockReply(() => {
      const p = this.find(projectId).details;
      if (p.progressPercent <= 0) return [{ date: today(), percent: 0 }];
      const days = range === '30d' ? 30 : range === '90d' ? 90 : 34;
      const points: ProgressPoint[] = [];
      let value = 0;
      for (let i = days; i >= 0; i -= 3) {
        const target = p.progressPercent * (1 - i / days);
        value = Math.max(value, Math.round((target + (Math.random() * 3 - 1.5)) * 10) / 10);
        points.push({ date: isoDay(-i), percent: Math.min(p.progressPercent, Math.max(0, value)) });
      }
      points[points.length - 1] = { date: today(), percent: p.progressPercent };
      return points;
    });
  }

  timeline(projectId: number, pageIndex: number, pageSize: number): Observable<PagedResult<TimelineEvent>> {
    return mockReply(() => page(this.find(projectId).timeline, pageIndex, pageSize));
  }

  credentials(projectId: number): Observable<ClientCredential[]> {
    return mockReply(() => this.find(projectId).credentials.map(({ password, ...c }) => (void password, c)));
  }

  revealCredential(projectId: number, credentialId: number): Observable<{ password: string }> {
    return mockReply(() => {
      const c = this.find(projectId).credentials.find((x) => x.id === credentialId);
      if (!c?.password) fail(404, 'not_found', 'Credential not found');
      return { password: c.password };
    }, 400);
  }

  releases(projectId: number): Observable<ClientRelease[]> {
    return mockReply(() => this.find(projectId).releases);
  }

  downloadLink(projectId: number, releaseId: number): Observable<DownloadLink> {
    return mockReply(() => {
      const r = this.find(projectId).releases.find((x) => x.id === releaseId);
      if (!r?.hasFile) fail(404, 'not_found', 'Release not found');
      const blob = new Blob([`Demo APK placeholder for ${r.fileName}`], { type: 'application/vnd.android.package-archive' });
      return { url: URL.createObjectURL(blob), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
    }, 450);
  }

  requests(projectId: number, query: RequestListQuery): Observable<PagedResult<ClientRequestListItem>> {
    return mockReply(() => {
      const list = this.db
        .get()
        .requests.filter((r) => r.projectId === projectId)
        .filter((r) => !query.status || r.status === query.status)
        .filter((r) => !query.type || r.type === query.type)
        .map(toListItem);
      return page(list, query.pageIndex ?? 1, query.pageSize ?? 50);
    });
  }

  createRequest(projectId: number, input: NewRequestInput): Observable<ClientRequestDetails> {
    return mockReply(() => {
      const project = this.find(projectId);
      const id = this.bumpId();
      const created: ClientRequestDetails = {
        id, projectId, projectName: project.details.name, type: input.type, title: input.title.trim(),
        status: 'Open', priority: null, clientName: this.db.get().visitorName ?? CUSTOMER.name,
        assignedToId: null, assignedToName: null, commentsCount: 0, attachmentsCount: input.attachments.length,
        createdAt: nowIso(), updatedAt: null, description: input.description.trim(), resolvedAt: null,
        attachments: [], comments: [],
      };
      this.db.update((d) => d.requests.unshift(created));
      return created;
    }, 600);
  }

  request(id: number): Observable<ClientRequestDetails> {
    return mockReply(() => {
      const r = this.db.get().requests.find((x) => x.id === id);
      if (!r) fail(404, 'not_found', 'Request not found');
      return r;
    });
  }

  comment(id: number, body: string, attachments: File[]): Observable<ClientRequestComment> {
    return mockReply(() => {
      const comment: ClientRequestComment = {
        id: this.bumpId(),
        authorName: this.db.get().visitorName ?? CUSTOMER.name,
        authorRole: 'Client',
        isMine: true,
        body: body.trim(),
        attachments: [],
        createdAt: nowIso(),
      };
      void attachments;
      this.db.update((d) => {
        const r = d.requests.find((x) => x.id === id);
        if (!r) return;
        r.comments.push(comment);
        r.commentsCount = r.comments.length;
        r.updatedAt = comment.createdAt;
        if (r.status === 'Resolved') r.status = 'InReview';
      });
      return comment;
    });
  }

  private find(projectId: number): DemoProject {
    const p = this.db.get().projects.find((x) => x.details.projectId === projectId);
    if (!p) fail(404, 'not_found', 'Project not found');
    return p;
  }

  private bumpId(): number {
    let id = 0;
    this.db.update((d) => (id = ++d.nextId));
    return id;
  }
}

function toListItem(r: ClientRequestDetails): ClientRequestListItem {
  const { description, resolvedAt, attachments, comments, ...item } = r;
  void description; void resolvedAt; void attachments; void comments;
  return item;
}

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function today(): string {
  return isoDay(0);
}
