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
];
