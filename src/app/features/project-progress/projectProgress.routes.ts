import { Routes } from '@angular/router';

/**
 * Only `/my-reports` lives here as a genuinely top-level route (it isn't
 * scoped to a single project). Every other project-progress page is
 * registered as a sibling of `ProjectManage` in `projectsTasks.routes.ts`
 * since it's reached from a specific project's row action.
 */
export const PROJECT_PROGRESS_ROUTES: Routes = [
  {
    path: 'my-reports',
    title: 'تقاريري',
    data: { roles: ['Admin', 'Developer'] },
    loadComponent: () =>
      import('./pages/my-reports/my-reports.component').then((m) => m.MyReportsComponent),
  },
];
