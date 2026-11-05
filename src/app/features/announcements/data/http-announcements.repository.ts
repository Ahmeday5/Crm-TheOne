import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { Announcement, AnnouncementInput } from '../models/announcement.models';
import { AnnouncementsRepository } from './announcements.repository';

/**
 * Real backend adapter — implements `docs/api/announcements.md`.
 *
 * The server owns delivery (it notifies every targeted employee on create),
 * read receipts and the read/recipient counters. Reads skip the global loader
 * because the banner polls quietly in the background.
 */
@Injectable({ providedIn: 'root' })
export class HttpAnnouncementsRepository extends AnnouncementsRepository {
  private readonly api = inject(ApiService);

  readonly externalChanges$: Observable<void> = EMPTY;

  list(): Observable<Announcement[]> {
    return this.api
      .get<Announcement[]>(API_ENDPOINTS.announcements.list, { context: withSkipLoader() })
      .pipe(map((rows) => rows ?? []));
  }

  create(input: AnnouncementInput): Observable<Announcement> {
    return this.api.post<Announcement>(API_ENDPOINTS.announcements.create, input, {
      context: withInlineHandling(),
    });
  }

  update(id: string, input: AnnouncementInput): Observable<Announcement> {
    return this.api.put<Announcement>(API_ENDPOINTS.announcements.update(id), input, {
      context: withInlineHandling(),
    });
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<unknown>(API_ENDPOINTS.announcements.delete(id), { context: withInlineHandling() })
      .pipe(map(() => undefined));
  }

  setPinned(id: string, isPinned: boolean): Observable<Announcement> {
    return this.api.patch<Announcement>(
      API_ENDPOINTS.announcements.pin(id),
      { isPinned },
      { context: withInlineHandling() },
    );
  }

  markRead(id: string): Observable<void> {
    return this.api
      .post<unknown>(API_ENDPOINTS.announcements.read(id), {}, {
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map(() => undefined));
  }
}
