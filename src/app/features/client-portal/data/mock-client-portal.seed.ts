import {
  ClientProjectDetail,
  ClientRequest,
  Milestone,
  RequestComment,
  TimelineEvent,
} from '../models/client-portal.models';

let seq = 1;
export const mockId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${seq++}`;

export const daysAgo = (d: number): string => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number): string => new Date(Date.now() + d * 86_400_000).toISOString();

function milestones(doneCount: number, titles: string[]): Milestone[] {
  return titles.map((title, i) => ({
    id: mockId('ms'),
    title,
    status: i < doneCount ? 'Done' : i === doneCount ? 'InProgress' : 'Pending',
    completedAt: i < doneCount ? daysAgo((titles.length - i) * 6) : null,
  }));
}

/** The signed-in client's projects. */
export function seedClientProjects(): ClientProjectDetail[] {
  return [
    {
      projectId: 101,
      name: 'تطبيق متجر إلكتروني',
      status: 'InProgress',
      progressPercent: 62,
      startDate: daysAgo(48),
      expectedEndDate: daysAhead(30),
      lastUpdateAt: daysAgo(1),
      openRequests: 0,
      milestones: milestones(3, ['التحليل والتصميم', 'واجهات التطبيق', 'ربط الدفع الإلكتروني', 'لوحة التحكم', 'الاختبار والإطلاق']),
    },
    {
      projectId: 102,
      name: 'موقع الشركة التعريفي',
      status: 'Completed',
      progressPercent: 100,
      startDate: daysAgo(120),
      expectedEndDate: daysAgo(20),
      lastUpdateAt: daysAgo(20),
      openRequests: 0,
      milestones: milestones(4, ['التصميم', 'البرمجة', 'المحتوى', 'الإطلاق']),
    },
  ];
}

export function seedTimeline(projectId: number): TimelineEvent[] {
  return [
    { id: mockId('tl'), kind: 'release', title: 'نسخة جديدة متاحة للتجربة (1.4.0)', at: daysAgo(1) },
    { id: mockId('tl'), kind: 'milestone', title: 'اكتملت مرحلة: ربط الدفع الإلكتروني', at: daysAgo(6) },
    { id: mockId('tl'), kind: 'update', title: 'تحديث نسبة الإنجاز إلى 62%', at: daysAgo(6) },
    { id: mockId('tl'), kind: 'milestone', title: 'اكتملت مرحلة: واجهات التطبيق', at: daysAgo(12) },
    { id: mockId('tl'), kind: 'release', title: `بداية المشروع #${projectId}`, at: daysAgo(48) },
  ];
}

/** Requests already on a project (used for both the client and staff views). */
export function seedRequests(projectId: number, projectName: string): ClientRequest[] {
  return [
    {
      id: mockId('req'),
      projectId,
      projectName,
      type: 'Issue',
      title: 'زرار الدفع مش بيستجيب على آيفون',
      description: 'لما بدوس على "ادفع الآن" من آيفون 13 الصفحة مش بتتحرك. على أندرويد شغال عادي.',
      status: 'InProgress',
      priority: 'High',
      attachments: [{ name: 'screenshot.png', sizeBytes: 240_000, url: null }],
      createdByName: 'العميل',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      commentsCount: 2,
    },
    {
      id: mockId('req'),
      projectId,
      projectName,
      type: 'ChangeRequest',
      title: 'إضافة خيار الدفع عند الاستلام',
      description: 'محتاجين نضيف الدفع كاش عند الاستلام كخيار تاني.',
      status: 'Open',
      priority: null,
      attachments: [],
      createdByName: 'العميل',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      commentsCount: 0,
    },
  ];
}

export function seedComments(requestId: string): RequestComment[] {
  return [
    {
      id: mockId('cm'),
      requestId,
      authorName: 'فريق التطوير',
      authorRole: 'Staff',
      body: 'وصلنا البلاغ، بنراجع المشكلة على أجهزة iOS.',
      attachments: [],
      createdAt: daysAgo(2),
    },
    {
      id: mockId('cm'),
      requestId,
      authorName: 'فريق التطوير',
      authorRole: 'Staff',
      body: 'لقينا السبب وهيتحل في النسخة الجاية.',
      attachments: [],
      createdAt: daysAgo(1),
    },
  ];
}
