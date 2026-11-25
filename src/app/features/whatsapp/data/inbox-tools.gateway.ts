import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader, withUnauthorizedAsForbidden } from '../../../core/http/http-context.tokens';
import {
  Pagination,
  WaChat,
  WaChatCounters,
  WaChatLabel,
  WaChatNote,
  WaChatReminder,
  WaNewReminderRequest,
  WaRemindersQuery,
  WaTransferRequest,
} from '../models/whatsapp.models';
import { DEFAULT_AWAITING_THRESHOLD_MIN } from '../utils/inbox-tools.util';
import { normalizeChat } from '../utils/whatsapp.util';
import { ApiService } from '../../../core/services/api.service';

/** What a chat needs to carry for a reminder. */
export type ReminderChatRef = Pick<WaChat, 'id'>;

/**
 * Inbox v4 chat tools — labels, internal notes, reminders, counters and
 * transfer (`WhatsApp/chats/*`, `WhatsApp/reminders`). All state lives on the
 * server and is shared by the team; changes arrive live as
 * `whatsappChatUpdated` / `whatsappChatNoteAdded` on the WhatsApp hub.
 *
 * Kept behind an interface + token so components and tests depend on the
 * port, not on `HttpClient`.
 */
export interface InboxToolsGateway {

  /** `PUT chats/{id}/labels` → the updated chat. */
  setLabels(chat: WaChat, labels: WaChatLabel[]): Observable<WaChat>;

  notes(chatId: number): Observable<WaChatNote[]>;
  addNote(chatId: number, text: string): Observable<WaChatNote>;
  deleteNote(chatId: number, noteId: number): Observable<unknown>;

  addReminder(chat: ReminderChatRef, body: WaNewReminderRequest): Observable<WaChatReminder>;
  reminders(query: WaRemindersQuery): Observable<Pagination<WaChatReminder>>;
  reminderDone(id: number): Observable<unknown>;
  deleteReminder(id: number): Observable<unknown>;

  /** `GET chats/counters` — the two red badges. */
  counters(instanceId: string | null): Observable<WaChatCounters>;

  /** `POST chats/{id}/transfer` (Sales colleague) → the updated chat. */
  transfer(chat: WaChat, body: WaTransferRequest): Observable<WaChat>;
}

const WA = API_ENDPOINTS.whatsapp;

/** Same handling as `WhatsAppApiService`: inline errors, a 401 means "not allowed". */
function inline() {
  return withInlineHandling(withUnauthorizedAsForbidden());
}

@Injectable({ providedIn: 'root' })
export class HttpInboxToolsGateway implements InboxToolsGateway {
  private readonly api = inject(ApiService);

  setLabels(chat: WaChat, labels: WaChatLabel[]): Observable<WaChat> {
    return this.api.put<WaChat>(WA.chatLabels(chat.id), { labels }, { context: inline() }).pipe(map(normalizeChat));
  }

  notes(chatId: number): Observable<WaChatNote[]> {
    return this.api
      .get<WaChatNote[] | null>(WA.chatNotes(chatId), { context: inline() })
      .pipe(map((rows) => (Array.isArray(rows) ? rows : [])));
  }

  addNote(chatId: number, text: string): Observable<WaChatNote> {
    return this.api.post<WaChatNote>(WA.chatNotes(chatId), { text }, { context: inline() });
  }

  deleteNote(chatId: number, noteId: number): Observable<unknown> {
    return this.api.delete<unknown>(WA.chatNote(chatId, noteId), { context: inline() });
  }

  addReminder(chat: ReminderChatRef, body: WaNewReminderRequest): Observable<WaChatReminder> {
    return this.api.post<WaChatReminder>(WA.chatReminders(chat.id), body, { context: inline() });
  }

  reminders(query: WaRemindersQuery): Observable<Pagination<WaChatReminder>> {
    return this.api
      .get<Pagination<WaChatReminder> | null>(WA.reminders, {
        params: { ...query },
        context: withSkipLoader(inline()),
      })
      .pipe(
        map((page) => ({
          pageIndex: page?.pageIndex ?? query.pageIndex,
          pageSize: page?.pageSize ?? query.pageSize,
          count: page?.count ?? 0,
          data: Array.isArray(page?.data) ? page!.data : [],
        })),
      );
  }

  reminderDone(id: number): Observable<unknown> {
    return this.api.post<unknown>(WA.reminderDone(id), null, { context: inline() });
  }

  deleteReminder(id: number): Observable<unknown> {
    return this.api.delete<unknown>(WA.reminder(id), { context: inline() });
  }

  counters(instanceId: string | null): Observable<WaChatCounters> {
    return this.api
      .get<Partial<WaChatCounters> | null>(WA.chatCounters, {
        params: { instanceId: instanceId ?? undefined },
        context: withSkipLoader(inline()),
      })
      .pipe(
        map((c) => ({
          awaitingReply: c?.awaitingReply ?? 0,
          overdueReminders: c?.overdueReminders ?? 0,
          thresholdMinutes: c?.thresholdMinutes || DEFAULT_AWAITING_THRESHOLD_MIN,
        })),
      );
  }

  transfer(chat: WaChat, body: WaTransferRequest): Observable<WaChat> {
    return this.api.post<WaChat>(WA.chatTransfer(chat.id), body, { context: inline() }).pipe(map(normalizeChat));
  }
}

export const INBOX_TOOLS_GATEWAY = new InjectionToken<InboxToolsGateway>('INBOX_TOOLS_GATEWAY', {
  providedIn: 'root',
  factory: () => inject(HttpInboxToolsGateway),
});
