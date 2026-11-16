import { Routes } from '@angular/router';
import { provideClientPortalGateway } from './data/client-portal-gateway.provider';

/**
 * Client portal — Client role only (the role guard also locks clients to this
 * area). The gateway is provided once on the parent so both pages share it.
 */
export const CLIENT_PORTAL_ROUTES: Routes = [
  {
    path: 'client-portal',
    data: { roles: ['Client'] },
    providers: [provideClientPortalGateway()],
    children: [
      {
        path: '',
        title: 'مشاريعي',
        loadComponent: () =>
          import('./pages/client-projects/client-projects.component').then((m) => m.ClientProjectsComponent),
      },
      {
        path: 'projects/:id',
        title: 'تفاصيل المشروع',
        loadComponent: () =>
          import('./pages/client-project/client-project.component').then((m) => m.ClientProjectComponent),
      },
    ],
  },
];
