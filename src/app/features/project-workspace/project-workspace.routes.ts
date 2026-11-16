import { Routes } from '@angular/router';

/**
 * `/projects/:id` — the project workspace (Admin: everything; Developer on the
 * project: read-mostly + builds). `/projects/:id/workspace` is the old link.
 */
export const PROJECT_WORKSPACE_ROUTES: Routes = [
  {
    path: 'projects/:id',
    title: 'مساحة المشروع',
    data: { roles: ['Admin', 'Developer'] },
    loadComponent: () =>
      import('./pages/project-workspace/project-workspace.component').then((m) => m.ProjectWorkspaceComponent),
  },
  { path: 'projects/:id/workspace', redirectTo: 'projects/:id' },
];
