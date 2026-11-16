import { Routes } from '@angular/router';

/**
 * Project workspace — the single screen an admin runs a project from (team +
 * allocation + build archive). A developer opens their own project here too
 * (read-mostly: publish builds, no re-allocation). Clients never reach it.
 */
export const PROJECT_BUILDS_ROUTES: Routes = [
  {
    path: 'projects/:id/workspace',
    title: 'مساحة المشروع',
    data: { roles: ['Admin', 'Developer'] },
    loadComponent: () =>
      import('./pages/project-workspace/project-workspace.component').then(
        (m) => m.ProjectWorkspaceComponent,
      ),
  },
];
