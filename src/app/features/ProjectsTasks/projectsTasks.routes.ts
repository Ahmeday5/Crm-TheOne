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
  // Project progress & daily reporting — sibling routes (not nested under the
  // ProjectManage/TasksManage tab shell) so these render as full pages.
  {
    path: 'ProjectManage/:projectId/progress',
    title: 'متابعة تقدم المشروع',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import(
        '../project-progress/pages/project-progress-admin/project-progress-admin.component'
      ).then((m) => m.ProjectProgressAdminComponent),
  },
  {
    path: 'ProjectManage/:projectId/my-progress',
    title: 'تقدمي في المشروع',
    data: { roles: ['Developer'] },
    loadComponent: () =>
      import(
        '../project-progress/pages/my-project-progress/my-project-progress.component'
      ).then((m) => m.MyProjectProgressComponent),
  },
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
