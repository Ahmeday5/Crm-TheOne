import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withInlineHandling,
  withUnauthorizedAsForbidden,
} from '../../../core/http/http-context.tokens';
import { AppUser } from '../../../core/models/user.model';
import { ApiService } from '../../../core/services/api.service';
import { CustomerDropdownItem } from '../../../shared/models';
import {
  Pagination,
  WaAssignNumberRequest,
  WaChat,
  WaChatsQuery,
  WaConnectRequest,
  WaDiagnostics,
  WaEmployee,
  WaInstance,
  WaMessage,
  WaMessagesQuery,
  WaNumberStatus,
  WaPairingCode,
  WaSendMediaRequest,
  WaSendTarget,
  WaSendTextRequest,
} from '../models/whatsapp.models';
import { WHATSAPP_MAX_TAKE } from '../utils/whatsapp.util';

/** Roles that can be given a number. */
const ASSIGNABLE_ROLES: ReadonlySet<string> = new Set(['Sales', 'Support']);

/**
 * Typed HTTP boundary for `/api/WhatsApp/*`. Returns unwrapped `data`.
 *
 * Every call handles its own feedback (`withInlineHandling`: no global
 * loader, no automatic toast) — callers decide whether an error is a toast,
 * an inline state or a failed bubble. A 401 here is "you don't have access",
 * so it must never trigger a token refresh (`withUnauthorizedAsForbidden`).
 * Nothing is cached except the users roster: chats and statuses are live.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppApiService {
  private readonly api = inject(ApiService);
  private readonly ep = API_ENDPOINTS.whatsapp;

  // ─────────────── numbers ───────────────

  status(): Observable<WaNumberStatus> {
    return this.api.get<WaNumberStatus>(this.ep.status, { context: inline() });
  }

  instances(): Observable<WaInstance[]> {
    return this.api.get<WaInstance[] | null>(this.ep.instances, { context: inline() }).pipe(map(asArray));
  }

  instance(instanceId: string): Observable<WaInstance> {
    return this.api.get<WaInstance>(this.ep.instance(instanceId), { context: inline() });
  }

  /** Never log or persist the returned code. */
  connect(body: WaConnectRequest): Observable<WaPairingCode> {
    return this.api.post<WaPairingCode>(this.ep.connect, body, { context: inline() });
  }

  assignNumber(userId: string, body: WaAssignNumberRequest): Observable<WaInstance | null> {
    return this.api
      .put<WaInstance | null>(this.ep.userNumber(userId), body, { context: inline() })
      .pipe(map((res) => (isInstance(res) ? res : null)));
  }

  /** Admin health check: configuration, provider account vs. local numbers, webhook queue. */
  diagnostics(): Observable<WaDiagnostics> {
    return this.api.get<WaDiagnostics>(this.ep.diagnostics, { context: inline() });
  }

  /** Active Sales / Support users — the people a number can be assigned to. */
  employees(): Observable<WaEmployee[]> {
    return this.api
      .get<AppUser[] | null>(API_ENDPOINTS.users.list, {
        context: withInlineHandling(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
      })
      .pipe(
        map((rows) =>
          asArray(rows)
            .filter((u) => !!u?.userId && ASSIGNABLE_ROLES.has(String(u.role)))
            .map((u) => ({
              userId: u.userId,
              fullName: u.fullName?.trim() || u.email || '—',
              role: u.role as WaEmployee['role'],
            }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
        ),
      );
  }

  /** Customer picker for "New chat" — the backend still rejects customers not assigned to an employee. */
  customersDropdown(): Observable<CustomerDropdownItem[]> {
    return this.api
      .get<CustomerDropdownItem[] | null>(API_ENDPOINTS.customers.dropdown, {
        context: withInlineHandling(withCache({ ttlMs: CACHE_TTL.LONG })),
      })
      .pipe(map(asArray));
  }

  // ─────────────── chats & messages ───────────────

  chats(query: WaChatsQuery): Observable<Pagination<WaChat>> {
    return this.api
      .get<Pagination<WaChat> | null>(this.ep.chats, {
        params: { ...query, unreadOnly: query.unreadOnly || undefined },
        context: inline(),
      })
      .pipe(
        map((page) => ({
          pageIndex: page?.pageIndex ?? query.pageIndex,
          pageSize: page?.pageSize ?? query.pageSize,
          count: page?.count ?? 0,
          data: asArray(page?.data),
        })),
      );
  }

  /** Oldest first. Fewer than `take` rows = the start of the history. */
  chatMessages(chatId: number, query: WaMessagesQuery): Observable<WaMessage[]> {
    return this.api
      .get<WaMessage[] | null>(this.ep.chatMessages(chatId), {
        params: { take: clampTake(query.take), beforeId: query.beforeId },
        context: inline(),
      })
      .pipe(map(asArray));
  }

  customerMessages(customerId: number, take: number): Observable<WaMessage[]> {
    return this.api
      .get<WaMessage[] | null>(this.ep.customerMessages(customerId), {
        params: { take: clampTake(take) },
        context: inline(),
      })
      .pipe(map(asArray));
  }

  markChatRead(chatId: number): Observable<unknown> {
    return this.api.post<unknown>(this.ep.markChatRead(chatId), null, { context: inline() });
  }

  // ─────────────── sending (3–12 s anti-ban delay server-side) ───────────────

  sendText(req: WaSendTextRequest): Observable<WaMessage> {
    return this.api.post<WaMessage>(
      this.ep.send,
      {
        ...req.target,
        instanceId: req.instanceId,
        clientMessageId: req.clientMessageId,
        text: req.text,
      },
      { context: inline() },
    );
  }

  sendMedia(req: WaSendMediaRequest): Observable<WaMessage> {
    const form = new FormData();
    appendTarget(form, req.target);
    if (req.instanceId) form.append('instanceId', req.instanceId);
    form.append('clientMessageId', req.clientMessageId);
    if (req.caption?.trim()) form.append('caption', req.caption.trim());
    form.append('file', req.file, req.file.name);
    return this.api.post<WaMessage>(this.ep.sendMedia, form, { context: inline() });
  }
}

function inline() {
  return withInlineHandling(withUnauthorizedAsForbidden());
}

function appendTarget(form: FormData, target: WaSendTarget): void {
  if ('chatId' in target) form.append('chatId', String(target.chatId));
  else if ('customerId' in target) form.append('customerId', String(target.customerId));
  else form.append('phone', target.phone);
}

function clampTake(take: number): number {
  return Math.min(WHATSAPP_MAX_TAKE, Math.max(1, Math.floor(take)));
}

function asArray<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

/** `ApiService.unwrap` hands back the whole envelope when `data` is `null`. */
function isInstance(value: unknown): value is WaInstance {
  return !!value && typeof value === 'object' && typeof (value as WaInstance).id === 'string';
}
