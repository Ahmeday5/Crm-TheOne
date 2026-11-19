import { Routes } from '@angular/router';
import { CLIENT_REQUESTS_ROLES } from './client-requests.constants';

/** `/client-requests` — the Admin's triage inbox across all projects (`?tab=` picks the tab). */
export const CLIENT_REQUESTS_ROUTES: Routes = [
  {
    path: 'client-requests',
    title: 'طلبات العملاء',
    data: { roles: [...CLIENT_REQUESTS_ROLES] },
    loadComponent: () =>
      import('./pages/client-requests-inbox/client-requests-inbox.component').then((m) => m.ClientRequestsInboxComponent),
  },
];
