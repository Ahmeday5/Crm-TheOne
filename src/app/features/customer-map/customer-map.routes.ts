import { Routes } from '@angular/router';

export const CUSTOMER_MAP_ROUTES: Routes = [
  {
    // Sales see only their own customers — the backend scopes the data.
    path: 'customers/map',
    title: 'خريطة العملاء',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import('./pages/customer-map/customer-map.component').then((m) => m.CustomerMapComponent),
  },
];
