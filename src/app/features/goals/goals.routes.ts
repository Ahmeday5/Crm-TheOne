import { Routes } from '@angular/router';

export const GOALS_ROUTES: Routes = [
  {
    path: 'goals',
    title: 'الأهداف والتحفيز',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import('./pages/goals/goals.component').then((m) => m.GoalsComponent),
  },
  {
    path: 'goals/leaderboard',
    title: 'لوحة المتصدرين',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import('./pages/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent),
  },
];
