import { Routes } from '@angular/router';

/**
 * Announcements board — every employee reads the posts that target them;
 * publishing / editing / pinning is gated to Admin inside the page and in the
 * repository (the backend enforces it too).
 */
export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    path: 'announcements',
    title: 'لوحة الإعلانات',
    loadComponent: () =>
      import('./pages/announcements-board/announcements-board.component').then(
        (m) => m.AnnouncementsBoardComponent,
      ),
  },
];
