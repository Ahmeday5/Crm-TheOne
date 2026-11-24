import { Routes } from '@angular/router';
import { recreateOnParamChange } from '../../core/routing/param-aware-reuse.strategy';

/**
 * `/projects/:id` — the project workspace (Admin: everything; Developer on the
 * project: read-mostly + builds). `/projects/:id/workspace` is the old link.
 */
export const PROJECT_WORKSPACE_ROUTES: Routes = [
  {
    path: 'projects/:id',
    title: 'مساحة المشروع',
    data: recreateOnParamChange({ roles: ['Admin', 'Developer'] }),
    loadComponent: () =>
      import('./pages/project-workspace/project-workspace.component').then((m) => m.ProjectWorkspaceComponent),
  },
  { path: 'projects/:id/workspace', redirectTo: 'projects/:id' },
];
