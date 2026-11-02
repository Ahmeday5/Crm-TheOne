import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withInlineHandling,
  withUnauthorizedAsForbidden,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  AssignWhatsAppNumberRequest,
  SendWhatsAppMediaRequest,
  SendWhatsAppTextRequest,
  WhatsAppChat,
  WhatsAppChatsQuery,
  WhatsAppEmployee,
  WhatsAppInstance,
  WhatsAppMessage,
  WhatsAppNumberStatus,
  WhatsAppRecipient,
} from '../models/whatsapp.models';
import { WHATSAPP_MAX_TAKE } from '../utils/whatsapp.util';

interface RosterUser {
  userId: string;
  fullName?: string | null;
  email?: string | null;
}

/**
 * HTTP boundary for `/api/WhatsApp/*`.
 *
 * Every call handles its own feedback (`withInlineHandling`: no global loader,
 * no automatic error toast) — the inbox polls, and a spinner or toast every
 * few seconds would be noise. A 401 here is a business "not your customer",
 * so it must not trigger a token refresh (`withUnauthorizedAsForbidden`).
 * Nothing is cached: chats and messages must always be live.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppApiService {
  private readonly api = inject(ApiService);

  // ─────────────── inbox ───────────────

  chats(query: WhatsAppChatsQuery): Observable<PagedResult<WhatsAppChat>> {
    return this.api
      .get<PagedResult<WhatsAppChat> | null>(API_ENDPOINTS.whatsapp.chats, {
        params: { ...query },
        context: inline(),
      })
      .pipe(
        map((page) => ({
          pageIndex: page?.pageIndex ?? query.PageIndex,
          pageSize: page?.pageSize ?? query.PageSize,
          count: page?.count ?? 0,
          data: page?.data ?? [],
        })),
      );
  }

  chatMessages(chatId: number, take: number): Observable<WhatsAppMessage[]> {
    return this.api
      .get<WhatsAppMessage[] | null>(API_ENDPOINTS.whatsapp.chatMessages(chatId), {
        params: { take: clampTake(take) },
        context: inline(),
      })
      .pipe(map(asArray));
  }

  customerMessages(customerId: number, take: number): Observable<WhatsAppMessage[]> {
    return this.api
      .get<WhatsAppMessage[] | null>(API_ENDPOINTS.whatsapp.customerMessages(customerId), {
        params: { take: clampTake(take) },
        context: inline(),
      })
      .pipe(map(asArray));
  }

  markChatRead(chatId: number): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.whatsapp.markChatRead(chatId), null, {
      context: inline(),
    });
  }

  // ─────────────── sending ───────────────

  /** Resolves to the stored message (Wavex delays 3–12 s on purpose). */
  sendText(req: SendWhatsAppTextRequest): Observable<WhatsAppMessage> {
    return this.api.post<WhatsAppMessage>(
      API_ENDPOINTS.whatsapp.send,
      { ...recipientJson(req.recipient), text: req.text },
      { context: inline() },
    );
  }

  sendMedia(req: SendWhatsAppMediaRequest): Observable<WhatsAppMessage> {
    const form = new FormData();
    if ('customerId' in req.recipient) form.append('CustomerId', String(req.recipient.customerId));
    else form.append('Phone', req.recipient.phone);
    if (req.caption?.trim()) form.append('Caption', req.caption.trim());
    form.append('file', req.file, req.file.name);

    return this.api.post<WhatsAppMessage>(API_ENDPOINTS.whatsapp.sendMedia, form, {
      context: inline(),
    });
  }

  // ─────────────── numbers ───────────────

  myStatus(): Observable<WhatsAppNumberStatus> {
    return this.api.get<WhatsAppNumberStatus>(API_ENDPOINTS.whatsapp.status, { context: inline() });
  }

  instances(): Observable<WhatsAppInstance[]> {
    return this.api
      .get<WhatsAppInstance[] | null>(API_ENDPOINTS.whatsapp.instances, { context: inline() })
      .pipe(map(asArray));
  }

  assignNumber(userId: string, body: AssignWhatsAppNumberRequest): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.whatsapp.userNumber(userId), body, {
      context: inline(),
    });
  }

  /**
   * Everyone who can own a number: Sales + Support + Admins, merged and
   * de-duplicated. A roster that fails to load is skipped, not fatal.
   */
  employees(): Observable<WhatsAppEmployee[]> {
    const roster = (endpoint: string, role: WhatsAppEmployee['role']) =>
      this.api
        .get<RosterUser[] | null>(endpoint, {
          context: withInlineHandling(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
        })
        .pipe(
          map((rows) =>
            asArray(rows)
              .filter((u) => !!u?.userId)
              .map((u) => ({ userId: u.userId, fullName: u.fullName?.trim() || u.email || '—', role })),
          ),
          catchError(() => of([] as WhatsAppEmployee[])),
        );

    return forkJoin([
      roster(API_ENDPOINTS.auth.sales, 'Sales'),
      roster(API_ENDPOINTS.auth.support, 'Support'),
      roster(API_ENDPOINTS.auth.admins, 'Admin'),
    ]).pipe(
      map((lists) => {
        const byId = new Map<string, WhatsAppEmployee>();
        for (const u of lists.flat()) if (!byId.has(u.userId)) byId.set(u.userId, u);
        return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
      }),
    );
  }
}

function inline() {
  return withInlineHandling(withUnauthorizedAsForbidden());
}

function clampTake(take: number): number {
  return Math.min(WHATSAPP_MAX_TAKE, Math.max(1, Math.floor(take)));
}

function asArray<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

function recipientJson(r: WhatsAppRecipient): { customerId: number } | { phone: string } {
  return 'customerId' in r ? { customerId: r.customerId } : { phone: r.phone };
}
