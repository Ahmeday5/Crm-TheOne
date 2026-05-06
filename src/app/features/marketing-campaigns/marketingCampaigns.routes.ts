import { Routes } from '@angular/router';

export const MARKETING_CAMPAIGNS_ROUTES: Routes = [
  {
    path: 'marketing-campaigns',
    title: 'إدارة الحملات التسويقية',
    data: { roles: ['Admin', 'Marketing'] },
    loadComponent: () =>
      import('./pages/campaigns/campaigns.component').then(
        (m) => m.CampaignsComponent,
      ),
  },
];
