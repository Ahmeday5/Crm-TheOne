import { Observable } from 'rxjs';
import { Announcement, AnnouncementInput } from '../models/announcement.models';

/**
 * Persistence port for announcements.
 *
 * The store and UI depend only on this contract; the concrete adapter
 * (mock today, HTTP once the backend ships) is chosen in exactly one place:
 * `ANNOUNCEMENTS_REPOSITORY` in `announcements-repository.provider.ts`.
 *
 * Contract every adapter honours:
 *   - `list()` returns only what the caller may see (Admin: everything,
 *     employees: announcements that target them), with the caller's own
 *     `isRead` / `readAt` filled in.
 *   - `create()` also *delivers* the announcement — every targeted employee
 *     receives a real notification.
 */
export abstract class AnnouncementsRepository {
  abstract list(): Observable<Announcement[]>;
  abstract create(input: AnnouncementInput): Observable<Announcement>;
  abstract update(id: string, input: AnnouncementInput): Observable<Announcement>;
  abstract remove(id: string): Observable<void>;
  abstract setPinned(id: string, isPinned: boolean): Observable<Announcement>;
  abstract markRead(id: string): Observable<void>;

  /**
   * Fires when data changed somewhere else (another tab, a push event…) so
   * the store can refetch. Adapters without such a signal return `EMPTY`.
   */
  abstract readonly externalChanges$: Observable<void>;
}
