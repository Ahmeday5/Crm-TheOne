import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../http/http-context.tokens';
import { ApiService } from './api.service';
import {
  AppNotification,
  GenerateRemindersResult,
  NotificationListQuery,
  PagedResult,
  SendNotificationRequest,
  UnreadCountResult,
} from '../../shared/models';

/**
 * HTTP boundary for the per-user notification center.
 *
 * Reads skip the global loader (the bell / center own their spinners) and
 * aren't cached — counts and lists must stay fresh. Mutations use inline
 * handling so callers surface their own feedback.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);

  list(query: NotificationListQuery = {}): Observable<PagedResult<AppNotification>> {
    return this.api.get<PagedResult<AppNotification>>(
      API_ENDPOINTS.notifications.list,
      {
        params: query as Record<string, unknown>,
        context: withInlineHandling(),
      },
    );
  }

  unreadCount(): Observable<UnreadCountResult> {
    return this.api.get<UnreadCountResult>(
      API_ENDPOINTS.notifications.unreadCount,
      { context: withInlineHandling() },
    );
  }

  // These endpoints take no body (like Swagger). They skip the global loader
  // but DO surface errors — a failed read must never fail silently.
  markRead(id: number): Observable<unknown> {
    return this.api.patch<unknown>(
      API_ENDPOINTS.notifications.markRead(id),
      null,
      { context: withSkipLoader() },
    );
  }

  markAllRead(): Observable<unknown> {
    return this.api.patch<unknown>(
      API_ENDPOINTS.notifications.markAllRead,
      null,
      { context: withSkipLoader() },
    );
  }

  generateFollowupReminders(): Observable<GenerateRemindersResult> {
    return this.api.post<GenerateRemindersResult>(
      API_ENDPOINTS.notifications.generateFollowupReminders,
      null,
      { context: withSkipLoader() },
    );
  }

  send(payload: SendNotificationRequest): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.notifications.send,
      payload,
      { context: withInlineHandling() },
    );
  }

  // ─────────────── FCM push registration ───────────────

  registerFcmToken(token: string): Observable<unknown> {
    return this.api.post<unknown>(
      API_ENDPOINTS.notifications.registerFcmToken,
      { token },
      { context: withInlineHandling() },
    );
  }

  removeFcmToken(): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.notifications.removeFcmToken, {
      context: withInlineHandling(),
    });
  }
}
