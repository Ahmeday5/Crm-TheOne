import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { clientGuard } from '../../core/guards/client.guard';

/**
 * `/portal` — the client's whole app, in its own minimal shell (no staff
 * sidebar). Client role only; staff guards send a Client here, and this guard
 * sends staff back to their home.
 */
export const CLIENT_PORTAL_ROUTES: Routes = [
  {
    path: 'portal',
    canActivate: [authGuard, clientGuard],
    loadComponent: () =>
      import('./pages/client-layout/client-layout.component').then((m) => m.ClientLayoutComponent),
    children: [
      {
        path: '',
        title: 'مشاريعي',
        loadComponent: () => import('./pages/portal-home/portal-home.component').then((m) => m.PortalHomeComponent),
      },
      {
        path: 'projects/:id',
        title: 'تفاصيل المشروع',
        loadComponent: () =>
          import('./pages/portal-project/portal-project.component').then((m) => m.PortalProjectComponent),
      },
      {
        path: 'requests/:id',
        title: 'طلبي',
        loadComponent: () =>
          import('./pages/portal-request/portal-request.component').then((m) => m.PortalRequestComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
  // Old preview link.
  { path: 'client-portal', redirectTo: 'portal' },
];
