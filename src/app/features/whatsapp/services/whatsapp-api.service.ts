import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
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
  ApiResponse,
  Pagination,
  WaAssignNumberRequest,
  WaChat,
  WaChatsQuery,
  WaDiagnostics,
  WaEmployee,
  WaImportResult,
  WaInstance,
  WaMessage,
  WaMessagesQuery,
  WaNumberStatus,
  WaSendMediaRequest,
  WaSendTemplateRequest,
  WaSendTextRequest,
  WaTemplate,
  WaUploadEvent,
} from '../models/whatsapp.models';
import { WHATSAPP_IMPORT_MAX, WHATSAPP_MAX_TAKE, normalizeChannel, normalizeChat } from '../utils/whatsapp.util';

/** Roles that can be given a channel. */
const ASSIGNABLE_ROLES: ReadonlySet<string> = new Set(['Sales', 'Support']);

/** `ApiService` prefixes this; the upload call (raw `HttpClient`) needs it too. */
const API_BASE = environment.apiUrl.replace(/\/+$/, '');

/**
 * Typed HTTP boundary for `/api/WhatsApp/*` — one method per endpoint,
 * returning the unwrapped `data`.
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
  private readonly http = inject(HttpClient);
  private readonly ep = API_ENDPOINTS.whatsapp;

  // ─────────────── channels ───────────────

  status(): Observable<WaNumberStatus> {
    return this.api.get<WaNumberStatus>(this.ep.status, { context: inline() });
  }

  instances(): Observable<WaInstance[]> {
    return this.api
      .get<WaInstance[] | null>(this.ep.instances, { context: inline() })
      .pipe(map((rows) => asArray(rows).map(normalizeChannel)));
  }

  instance(instanceId: string): Observable<WaInstance> {
    return this.api.get<WaInstance>(this.ep.instance(instanceId), { context: inline() }).pipe(map(normalizeChannel));
  }

  /** Admin. A channel replaces the user's channel of the same type; `null` removes all of them. */
  assignNumber(userId: string, body: WaAssignNumberRequest): Observable<WaInstance | null> {
    return this.api
      .put<WaInstance | null>(this.ep.userNumber(userId), body, { context: inline() })
      .pipe(map((res) => (isInstance(res) ? normalizeChannel(res) : null)));
  }

  /** Admin health check: configuration, provider channels, webhook queue. */
  diagnostics(): Observable<WaDiagnostics> {
    return this.api.get<WaDiagnostics>(this.ep.diagnostics, { context: inline() });
  }

  /**
   * Admin. Pulls past conversations + recent messages from Mihwar. Takes
   * about a minute — no client timeout is applied; safe to run again.
   */
  importHistory(max = WHATSAPP_IMPORT_MAX): Observable<WaImportResult> {
    return this.api.post<WaImportResult>(this.ep.import, null, { params: { max }, context: inline() });
  }

  /** Active Sales / Support users — the people a channel can be assigned to. */
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

  /** Customer picker for "New chat". */
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
          data: asArray(page?.data).map(normalizeChat),
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

  /** Every chat of one CRM customer (customer profile). */
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

  // ─────────────── sending ───────────────

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

  /**
   * Multipart upload with progress: emits `progress` events (0–100), then
   * `done` with the stored message. The browser sets the multipart boundary,
   * so no Content-Type is set here.
   */
  sendMedia(req: WaSendMediaRequest): Observable<WaUploadEvent> {
    const form = new FormData();
    form.append('file', req.file, req.file.name);
    form.append('chatId', String(req.chatId));
    form.append('clientMessageId', req.clientMessageId);
    if (req.caption?.trim()) form.append('caption', req.caption.trim());

    return this.http
      .post<ApiResponse<WaMessage> | WaMessage>(`${API_BASE}/${this.ep.sendMedia}`, form, {
        context: inline(),
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event) => toUploadEvent(event)),
        filter((event): event is WaUploadEvent => event !== null),
      );
  }

  /** Approved templates of my WhatsApp number (admins may pick the channel). */
  templates(instanceId?: string | null): Observable<WaTemplate[]> {
    return this.api
      .get<WaTemplate[] | null>(this.ep.templates, {
        params: { instanceId: instanceId || undefined },
        context: inline(),
      })
      .pipe(map(asArray));
  }

  sendTemplate(req: WaSendTemplateRequest): Observable<WaMessage> {
    return this.api.post<WaMessage>(
      this.ep.sendTemplate,
      {
        ...req.target,
        instanceId: req.instanceId,
        clientMessageId: req.clientMessageId,
        templateId: req.templateId,
        template: req.template,
        language: req.language,
        parameters: req.parameters,
      },
      { context: inline() },
    );
  }
}

function inline() {
  return withInlineHandling(withUnauthorizedAsForbidden());
}

function toUploadEvent(event: HttpEvent<ApiResponse<WaMessage> | WaMessage>): WaUploadEvent | null {
  if (event.type === HttpEventType.UploadProgress) {
    const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
    return { kind: 'progress', percent: Math.min(100, Math.max(0, percent)) };
  }
  if (event.type === HttpEventType.Response) {
    const body = event.body;
    const message = body && 'data' in body ? body.data : (body as WaMessage | null);
    return { kind: 'done', message: message as WaMessage };
  }
  return null;
}

function clampTake(take: number): number {
  return Math.min(WHATSAPP_MAX_TAKE, Math.max(1, Math.floor(take)));
}

function asArray<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows : [];
}

/** `ApiService.unwrap` hands back the whole envelope when `data` is `null`. */
function isInstance(value: unknown): value is WaInstance {
  if (!value || typeof value !== 'object' || 'statusCode' in value) return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number';
}
