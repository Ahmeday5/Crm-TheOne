import { Routes } from '@angular/router';

export const PROJECTS_TASKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/projects-and-tasks/projects-and-tasks.component').then(
        (m) => m.ProjectsAndTasksComponent,
      ),
    children: [
      { path: '', redirectTo: 'ProjectManage', pathMatch: 'full' },
      {
        path: 'ProjectManage',
        title: 'إدارة المشاريع',
        loadComponent: () =>
          import('./pages/project-manage/project-manage.component').then(
            (m) => m.ProjectManageComponent,
          ),
      },
      {
        path: 'TasksManage',
        title: 'إدارة المهام',
        loadComponent: () =>
          import('./pages/tasks-manage/tasks-manage.component').then(
            (m) => m.TasksManageComponent,
          ),
      },
    ],
  },
  // Progress / daily reporting now live inside the project workspace
  // (`/projects/:id`). The old links redirect to the matching tab.
  {
    path: 'ProjectManage/:projectId/progress',
    redirectTo: ({ params }) => `/projects/${params['projectId']}?tab=team`,
  },
  {
    path: 'ProjectManage/:projectId/my-progress',
    redirectTo: ({ params }) => `/projects/${params['projectId']}?tab=myReport`,
  },
  // Report pages stay full pages (opened from the workspace "reports" tab).
  {
    path: 'ProjectManage/reports/:reportId/edit',
    title: 'تعديل التقرير',
    data: { roles: ['Developer'] },
    loadComponent: () =>
      import('../project-progress/pages/report-form/report-form.component').then(
        (m) => m.ReportFormComponent,
      ),
  },
  {
    path: 'ProjectManage/reports/:reportId',
    title: 'تفاصيل التقرير',
    loadComponent: () =>
      import('../project-progress/pages/report-detail/report-detail.component').then(
        (m) => m.ReportDetailComponent,
      ),
  },
];
