import { Routes } from '@angular/router';

const loadBoard = () =>
  import('./pages/announcements-board/announcements-board.component').then(
    (m) => m.AnnouncementsBoardComponent,
  );

/**
 * Announcements board — every employee reads what targets them; publishing,
 * editing and read stats are Admin-only inside the page (and on the server).
 *
 * `/announcements/:id` is the notification deep link: it opens that
 * announcement on top of the board.
 */
export const ANNOUNCEMENTS_ROUTES: Routes = [
  { path: 'announcements', title: 'لوحة الإعلانات', loadComponent: loadBoard },
  { path: 'announcements/:id', title: 'لوحة الإعلانات', loadComponent: loadBoard },
];
