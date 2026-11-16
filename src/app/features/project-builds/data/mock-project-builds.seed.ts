import { ProjectDeveloper } from '../models/project-allocation.models';
import { BuildPlatform, ProjectBuild, BuildStatus } from '../models/project-build.models';

/** Deterministic-ish mock ids — good enough for a preview. */
let seq = 1;
export const mockId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${seq++}`;

const DEV_NAMES = [
  { id: 'dev-ahmed', name: 'أحمد سمير', role: 'Backend' },
  { id: 'dev-mona', name: 'منى خالد', role: 'Frontend' },
  { id: 'dev-yassin', name: 'ياسين فؤاد', role: 'Mobile' },
  { id: 'dev-salma', name: 'سلمى عادل', role: 'QA' },
];

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

/** A project's starting team allocation (shares sum to 100). */
export function seedDevelopers(): ProjectDeveloper[] {
  const shares = [40, 30, 20, 10];
  const tasks = [[8, 6], [6, 5], [5, 2], [4, 4]];
  return DEV_NAMES.map((d, i) => ({
    developerId: d.id,
    developerName: d.name,
    developerImageUrl: null,
    allocationPercent: shares[i],
    roleOnProject: d.role,
    tasksTotal: tasks[i][0],
    tasksDone: tasks[i][1],
    assignedAt: iso(30 - i * 3),
  }));
}

/** A project's starting build history (newest first). */
export function seedBuilds(projectId: number): ProjectBuild[] {
  const rows: Array<{
    v: string;
    p: BuildPlatform;
    dev: number;
    status: BuildStatus;
    notes: string;
    days: number;
  }> = [
    { v: '1.4.0', p: 'Android', dev: 2, status: 'Pushed', notes: 'إصلاح شاشة الدفع + تحسين الأداء', days: 1 },
    { v: '1.3.2', p: 'Android', dev: 2, status: 'Pushed', notes: 'إصلاحات بسيطة', days: 6 },
    { v: '1.3.0', p: 'Web', dev: 1, status: 'Failed', notes: 'إضافة لوحة التقارير', days: 9 },
    { v: '1.2.0', p: 'Backend', dev: 0, status: 'Pushed', notes: 'ربط بوابة الدفع', days: 15 },
  ];
  const n = rows.length;
  return rows.map((r, i) => {
    const dev = DEV_NAMES[r.dev];
    return {
      id: mockId('build'),
      projectId,
      buildNumber: n - i,
      versionName: r.v,
      platform: r.p,
      developerId: dev.id,
      developerName: dev.name,
      artifactUrl: r.p === 'Backend' ? null : '#',
      artifactName: r.p === 'Android' ? `app-${r.v}.apk` : r.p === 'Web' ? `web-${r.v}.zip` : `api-${r.v}.zip`,
      artifactSizeBytes: 8_400_000 + i * 1_200_000,
      notes: r.notes,
      gitRepoUrl: 'https://github.com/the-one-system/project-' + projectId,
      gitBranch: 'main',
      gitCommitSha: r.status === 'Pushed' ? Math.random().toString(16).slice(2, 9) : null,
      gitTag: r.status === 'Pushed' ? `v${r.v}` : null,
      status: r.status,
      errorMessage: r.status === 'Failed' ? 'فشل الدفع على GitHub — تحقق من صلاحيات التوكن' : null,
      createdAt: iso(r.days),
    };
  });
}
