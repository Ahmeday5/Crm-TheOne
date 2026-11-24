import { Routes } from '@angular/router';
import { recreateOnParamChange } from '../../core/routing/param-aware-reuse.strategy';
import { portalSessionGuard } from './data/portal-session.guard';

/**
 * Client portal — opened ONLY from the customer's private link, never with a
 * username / password.
 *
 *   /p/:token        the link: branded intro → session → /portal
 *   /portal/access   why the portal can't open (revoked, expired, no link…)
 *   /portal/**       the portal itself, in its own shell (no staff chrome)
 */
export const CLIENT_PORTAL_ROUTES: Routes = [
  {
    path: 'p/:token',
    title: 'TheOne',
    data: recreateOnParamChange(),
    loadComponent: () => import('./pages/portal-entry/portal-entry.component').then((m) => m.PortalEntryComponent),
  },
  {
    path: 'portal/access',
    title: 'TheOne',
    loadComponent: () => import('./pages/portal-access/portal-access.component').then((m) => m.PortalAccessComponent),
  },
  {
    path: 'portal',
    canActivate: [portalSessionGuard],
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
        data: recreateOnParamChange(),
        loadComponent: () =>
          import('./pages/portal-project/portal-project.component').then((m) => m.PortalProjectComponent),
      },
      {
        path: 'requests/:id',
        title: 'طلبي',
        data: recreateOnParamChange(),
        loadComponent: () =>
          import('./pages/portal-request/portal-request.component').then((m) => m.PortalRequestComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
  // Old preview link.
  { path: 'client-portal', redirectTo: 'portal' },
];
