import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  Announcement,
  AnnouncementDto,
  AnnouncementInput,
  AnnouncementQuery,
  AnnouncementReader,
} from '../models/announcement.models';
import { toAnnouncement, toReader } from './announcement.mapper';

/**
 * `Announcements/*` over HTTP.
 *
 * Reads skip the global loader (the banner refreshes quietly in the
 * background); mutations use inline handling so the caller shows the
 * server's `message` itself (in the form or as a toast).
 */
@Injectable({ providedIn: 'root' })
export class HttpAnnouncementsRepository {
  private readonly api = inject(ApiService);

  list(query: AnnouncementQuery): Observable<Announcement[]> {
    return this.api
      .get<AnnouncementDto[]>(API_ENDPOINTS.announcements.list, {
        params: { includeExpired: query.includeExpired, search: query.search.trim() },
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map((rows) => (rows ?? []).map(toAnnouncement)));
  }

  active(): Observable<Announcement[]> {
    return this.api
      .get<AnnouncementDto[]>(API_ENDPOINTS.announcements.active, {
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map((rows) => (rows ?? []).map(toAnnouncement)));
  }

  /** `null` when the server answers without the saved row (caller refetches). */
  create(input: AnnouncementInput): Observable<Announcement | null> {
    return this.api
      .post<AnnouncementDto | null>(API_ENDPOINTS.announcements.create, input, {
        context: withInlineHandling(),
      })
      .pipe(map(toAnnouncementOrNull));
  }

  update(id: number, input: AnnouncementInput): Observable<Announcement | null> {
    return this.api
      .put<AnnouncementDto | null>(API_ENDPOINTS.announcements.update(id), input, {
        context: withInlineHandling(),
      })
      .pipe(map(toAnnouncementOrNull));
  }

  remove(id: number): Observable<void> {
    return this.api
      .delete<unknown>(API_ENDPOINTS.announcements.delete(id), { context: withInlineHandling() })
      .pipe(map(() => undefined));
  }

  markRead(id: number): Observable<void> {
    return this.api
      .post<unknown>(API_ENDPOINTS.announcements.read(id), {}, {
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map(() => undefined));
  }

  readers(id: number): Observable<AnnouncementReader[]> {
    return this.api
      .get<AnnouncementReader[]>(API_ENDPOINTS.announcements.readers(id), {
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map((rows) => (rows ?? []).map(toReader)));
  }
}

function toAnnouncementOrNull(dto: AnnouncementDto | null): Announcement | null {
  return dto && typeof dto === 'object' && 'id' in dto ? toAnnouncement(dto) : null;
}
