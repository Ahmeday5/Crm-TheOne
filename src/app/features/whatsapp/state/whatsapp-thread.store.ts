import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, Subscription, interval, tap, throwError, timer } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import {
  WaChat,
  WaMessage,
  WaMessageEvent,
  WaMessageStatusEvent,
  WaSendTarget,
  WaSendTemplateRequest,
} from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { WindowFocusService } from '../services/window-focus.service';
import { ComposerState, resolveComposerState } from '../utils/composer-state.util';
import {
  WHATSAPP_MAX_TAKE,
  WHATSAPP_MESSAGES_TAKE,
  advanceStatus,
  isOutgoing,
  isPermissionError,
  isRejection,
  isTransientError,
  mediaKindOf,
  messageTypeForFile,
  newClientMessageId,
  whatsappErrorText,
} from '../utils/whatsapp.util';
import { WhatsAppSessionStore } from './whatsapp-session.store';

/**
 * Where a thread's messages come from and where its replies go:
 * - `chat`: one inbox conversation — replies go by `chatId`; `chat` carries
 *   the 24-hour window (`canReply`, `canSendTemplate`), `null` while unknown;
 * - `customer`: everything with one customer (profile tab) — history plus
 *   templates by `customerId`; free replies happen in the inbox.
 */
export type ThreadSource =
  | { kind: 'chat'; chatId: number; chat: WaChat | null }
  | { kind: 'customer'; customerId: number };

/** What the user asked to send — kept so a failed send can be retried as-is (file included). */
export interface OutgoingPayload {
  clientMessageId: string;
  text: string;
  file: File | null;
  /** Object URL for an image preview; revoked once no bubble needs it. */
  previewUrl: string | null;
  /**
   * The last attempt's outcome is unknown (offline, gateway timeout): a retry
   * must reuse the same `clientMessageId` so the backend can't send twice.
   */
  reuseIdOnRetry: boolean;
}

/** A rendered message: server rows plus optimistic ones still in flight. */
export interface ThreadMessage extends WaMessage {
  /** Present while this bubble can be re-sent with its original payload. */
  local?: OutgoingPayload;
  /** 0–100 while a file uploads. */
  uploadProgress?: number;
}

/** The server refused a send (business rule) — nothing went out; give the draft back. */
export interface RejectedDraft {
  clientMessageId: string;
  text: string;
  file: File | null;
  reason: string;
}

/** The template fields the picker fills; the store adds the target. */
export type TemplateSend = Omit<WaSendTemplateRequest, 'target'>;

/** Automatic retries (same id) after a network error, before showing "Failed". */
const TRANSIENT_RETRY_DELAYS_MS = [2_000, 5_000];
/** The reply window is re-evaluated this often (countdown + automatic close). */
const CLOCK_TICK_MS = 30_000;

/**
 * State for one conversation — the inbox's open chat or a customer's
 * WhatsApp tab. Provided per thread component, never at root.
 *
 * - History: newest 50 first; older pages by `beforeId` (customer threads
 *   widen `take` instead — that endpoint has no cursor).
 * - Live: hub messages are appended (deduped by id, replacing the optimistic
 *   bubble with the same `clientMessageId`); status events move ticks
 *   forward only; chat events refresh the reply window. After a reconnect
 *   the latest page is merged back in.
 * - Composer: one computed `composer` state (reply / template only / locked)
 *   from the chat's window, the channel and the caller's access.
 * - Sending: each text / file is its own optimistic bubble with a fresh
 *   `clientMessageId`; uploads report progress. A 400 removes nothing from
 *   the user — `rejected$` hands the draft back to the composer.
 */
@Injectable()
export class WhatsAppThreadStore {
  private readonly api = inject(WhatsAppApiService);
  private readonly realtime = inject(WhatsAppRealtimeService);
  private readonly session = inject(WhatsAppSessionStore);
  private readonly focus = inject(WindowFocusService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly source = signal<ThreadSource | null>(null);
  /** The open chat's latest details (source, then hub updates). */
  private readonly chatInfo = signal<WaChat | null>(null);
  /** Stored messages, ascending by id, unique. */
  private readonly server = signal<WaMessage[]>([]);
  /** Optimistic bubbles not yet stored. */
  private readonly pending = signal<ThreadMessage[]>([]);
  /** Payloads that can still be re-sent, by `clientMessageId`. */
  private readonly outbox = signal<ReadonlyMap<string, OutgoingPayload>>(new Map());
  /** Ticks so the reply window closes / counts down without a reload. */
  private readonly now = signal(Date.now());
  /** Customer threads page by widening `take`. */
  private customerTake = WHATSAPP_MESSAGES_TAKE;

  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  /** The whole history is loaded ("Beginning of conversation"). */
  readonly reachedStart = signal(false);
  /** Customer threads stop at the API's `take` cap. */
  readonly atHistoryLimit = signal(false);
  readonly error = signal<string | null>(null);
  /** 401: this chat / customer isn't the caller's. */
  readonly forbidden = signal(false);

  readonly messages = computed<ThreadMessage[]>(() => {
    const outbox = this.outbox();
    const stored = this.server().map((m): ThreadMessage => {
      const local = m.status === 'Failed' && m.clientMessageId ? outbox.get(m.clientMessageId) : undefined;
      return local ? { ...m, local } : m;
    });
    return [...stored, ...this.pending()];
  });
  readonly isEmpty = computed(() => !this.loading() && this.messages().length === 0);
  readonly canLoadOlder = computed(
    () => !this.reachedStart() && !this.atHistoryLimit() && this.server().length > 0,
  );

  readonly kind = computed(() => this.source()?.kind ?? null);
  readonly chat = this.chatInfo.asReadonly();

  /** The channel replies go out from, when known. */
  readonly instanceId = computed(() => this.chatInfo()?.instanceId ?? null);

  /** What the composer offers right now — see `resolveComposerState`. */
  readonly composer = computed<ComposerState>(() =>
    resolveComposerState({
      scope: this.source()?.kind === 'customer' ? 'customer' : 'chat',
      chat: this.chatInfo(),
      forbidden: this.forbidden(),
      channelCanSend: this.session.canSendFrom(this.instanceId()),
      now: this.now(),
    }),
  );

  /** Where a template from this thread goes. */
  readonly templateTarget = computed<WaSendTarget | null>(() => {
    const source = this.source();
    if (!source) return null;
    return source.kind === 'chat' ? { chatId: source.chatId } : { customerId: source.customerId };
  });

  /** The conversation the latest message belongs to — "Open in inbox" from a customer tab. */
  readonly latestChatId = computed(() => {
    const list = this.server();
    return list.length ? list[list.length - 1].chatId : null;
  });

  private readonly sentSubject = new Subject<WaMessage>();
  private readonly readSubject = new Subject<number>();
  private readonly rejectedSubject = new Subject<RejectedDraft>();
  /** Each message the server stored from this thread. */
  readonly sent$: Observable<WaMessage> = this.sentSubject.asObservable();
  /** The chat was marked read on the server (by id). */
  readonly read$: Observable<number> = this.readSubject.asObservable();
  /** A text / file send the server refused (400) — the composer may take the draft back. */
  readonly rejected$: Observable<RejectedDraft> = this.rejectedSubject.asObservable();

  /** Bumped on every `connect()` — late responses for an old source are dropped. */
  private generation = 0;
  private loadSub: Subscription | null = null;
  /** Incoming messages arrived while the window was not focused. */
  private unreadWhileAway = false;
  /** Server failures already re-sent — their bubble no longer offers Retry. */
  private readonly retried = new Set<number>();

  constructor() {
    this.realtime.message$.pipe(takeUntilDestroyed()).subscribe((e) => this.onHubMessage(e));
    this.realtime.messageStatus$.pipe(takeUntilDestroyed()).subscribe((e) => this.onHubStatus(e));
    this.realtime.chatUpdated$.pipe(takeUntilDestroyed()).subscribe((chat) => this.onHubChat(chat));
    this.realtime.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
    interval(CLOCK_TICK_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));

    // Back to the window with unread incoming messages → report them read.
    effect(() => {
      if (!this.focus.focused()) return;
      untracked(() => {
        if (this.unreadWhileAway) this.markRead();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.loadSub?.unsubscribe();
      this.revokeAll();
    });
  }

  // ─────────────── lifecycle ───────────────

  /** Switch to `source` (or detach with `null`). */
  connect(source: ThreadSource | null): void {
    if (sameSource(this.source(), source)) {
      // Same conversation, fresher details (e.g. the window just changed).
      if (source) this.source.set(source);
      if (source?.kind === 'chat' && source.chat) this.chatInfo.set(source.chat);
      return;
    }

    this.generation++;
    this.loadSub?.unsubscribe();
    this.revokeAll();
    this.source.set(source);
    this.chatInfo.set(source?.kind === 'chat' ? source.chat : null);
    this.server.set([]);
    this.pending.set([]);
    this.outbox.set(new Map());
    this.retried.clear();
    this.customerTake = WHATSAPP_MESSAGES_TAKE;
    this.reachedStart.set(false);
    this.atHistoryLimit.set(false);
    this.error.set(null);
    this.forbidden.set(false);
    this.loadingOlder.set(false);
    this.unreadWhileAway = false;
    this.now.set(Date.now());
    this.loading.set(!!source);

    if (source) this.loadLatest('initial');
  }

  /** Merge the latest page back in (manual retry, reconnect). */
  refresh(): void {
    // The first load is still on its way and will bring (and mark read) the latest page.
    if (!this.source() || this.forbidden() || this.loading()) return;
    this.loadLatest(this.server().length ? 'merge' : 'initial');
  }

  loadOlder(): void {
    const source = this.source();
    if (!source || this.loadingOlder() || !this.canLoadOlder()) return;
    const gen = this.generation;
    this.loadingOlder.set(true);

    const read$ =
      source.kind === 'chat'
        ? this.api.chatMessages(source.chatId, { take: WHATSAPP_MESSAGES_TAKE, beforeId: this.server()[0].id })
        : this.api.customerMessages(source.customerId, this.customerTake + WHATSAPP_MESSAGES_TAKE);

    read$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (gen !== this.generation) return;
        this.loadingOlder.set(false);
        if (source.kind === 'chat') {
          this.reachedStart.set(rows.length < WHATSAPP_MESSAGES_TAKE);
        } else {
          this.customerTake = Math.min(WHATSAPP_MAX_TAKE, this.customerTake + WHATSAPP_MESSAGES_TAKE);
          this.reachedStart.set(rows.length < this.customerTake);
          this.atHistoryLimit.set(!this.reachedStart() && this.customerTake >= WHATSAPP_MAX_TAKE);
        }
        this.upsertMany(rows);
      },
      error: (err) => {
        if (gen !== this.generation) return;
        this.loadingOlder.set(false);
        if (isPermissionError(err)) this.forbidden.set(true);
      },
    });
  }

  // ─────────────── sending ───────────────

  /** Sends text, or a file with `text` as its caption. Never blocks: each call is its own bubble. */
  send(text: string, file: File | null = null): boolean {
    const body = text.trim();
    const source = this.source();
    if (source?.kind !== 'chat' || this.composer().mode !== 'reply' || (!body && !file)) return false;

    const payload: OutgoingPayload = {
      clientMessageId: newClientMessageId(),
      text: body,
      file,
      previewUrl: file && messageTypeForFile(file) === 'image' ? URL.createObjectURL(file) : null,
      reuseIdOnRetry: false,
    };
    this.pending.update((list) => [...list, this.optimistic(payload)]);
    this.dispatch(payload, 0);
    return true;
  }

  /**
   * Sends an approved template to this thread's target. The picker dialog
   * owns the request's lifecycle (spinner, inline error, retry with the same
   * id); the stored message lands in the thread on success.
   */
  sendTemplate(request: TemplateSend): Observable<WaMessage> {
    const target = this.templateTarget();
    if (!target) return throwError(() => new Error('No conversation is open'));
    const gen = this.generation;
    return this.api.sendTemplate({ ...request, target }).pipe(
      tap((stored) => {
        if (gen !== this.generation || !stored?.id) return;
        this.upsertMany([stored]);
        this.sentSubject.next(stored);
      }),
    );
  }

  /**
   * Re-send a failed message. Same id when the last outcome was unknown
   * (the backend returns the stored message instead of sending twice), a new
   * id after a definite failure.
   */
  retry(message: ThreadMessage): boolean {
    if (!this.canRetry(message) || this.composer().mode !== 'reply') return false;

    const original: OutgoingPayload = message.local ?? {
      clientMessageId: message.clientMessageId ?? newClientMessageId(),
      text: message.text ?? '',
      file: null,
      previewUrl: null,
      reuseIdOnRetry: false,
    };
    const payload: OutgoingPayload = {
      ...original,
      clientMessageId: original.reuseIdOnRetry ? original.clientMessageId : newClientMessageId(),
      reuseIdOnRetry: false,
    };

    // Retire the failed copy: a local bubble goes away, a stored row stays as history.
    if (message.id < 0) this.pending.update((list) => list.filter((m) => m.clientMessageId !== original.clientMessageId));
    else this.retried.add(message.id);
    // The preview moves to the new bubble, so it must not be revoked here.
    this.forget(original.clientMessageId, false);

    this.pending.update((list) => [...list, this.optimistic(payload)]);
    this.dispatch(payload, 0);
    return true;
  }

  canRetry(message: ThreadMessage): boolean {
    if (message.status !== 'Failed' || !isOutgoing(message) || this.retried.has(message.id)) return false;
    if (message.local) return true;
    // A stored failure without its payload (e.g. after a reload) can be re-sent when it was text.
    return mediaKindOf(message.messageType) === 'text' && !!message.text?.trim();
  }

  /** Drop a failed local bubble whose draft went back into the composer. */
  discard(clientMessageId: string): void {
    this.pending.update((list) => list.filter((m) => m.clientMessageId !== clientMessageId));
    // The composer now owns the file again — keep its preview URL alive for nothing here.
    this.forget(clientMessageId, true);
  }

  // ─────────────── internals: loading ───────────────

  private loadLatest(mode: 'initial' | 'merge'): void {
    const source = this.source();
    if (!source) return;
    const gen = this.generation;
    this.loadSub?.unsubscribe();

    const take = source.kind === 'chat' ? WHATSAPP_MESSAGES_TAKE : this.customerTake;
    const read$ =
      source.kind === 'chat'
        ? this.api.chatMessages(source.chatId, { take })
        : this.api.customerMessages(source.customerId, take);

    this.loadSub = read$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (gen !== this.generation) return;
        this.loading.set(false);
        this.error.set(null);
        const newest = this.server()[this.server().length - 1]?.id ?? 0;
        if (mode === 'initial') {
          // `connect()` already emptied the list; anything there now arrived live meanwhile — keep it.
          this.reachedStart.set(rows.length < take);
        } else if (rows.length && rows[0].id > newest) {
          // No overlap with what we hold → a gap: start over from this page.
          this.server.set([]);
          this.reachedStart.set(rows.length < take);
        }
        this.upsertMany(rows);
        if (mode === 'initial') this.markReadOnOpen();
      },
      error: (err) => {
        if (gen !== this.generation) return;
        this.loading.set(false);
        if (isPermissionError(err)) {
          this.forbidden.set(true);
          return;
        }
        // A failed background merge keeps the last good view.
        if (!this.server().length) {
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.loadMessages'));
        }
      },
    });
  }

  // ─────────────── internals: hub ───────────────

  private onHubMessage({ instanceId, chat, message }: WaMessageEvent): void {
    if (!this.belongs(chat)) return;
    if (this.source()?.kind === 'chat') this.chatInfo.set({ ...chat, instanceId: instanceId || chat.instanceId });
    this.upsertMany([message]);

    if (message.direction === 'Incoming' && this.source()?.kind === 'chat') {
      if (this.focus.focused()) this.markRead();
      else this.unreadWhileAway = true;
    }
  }

  /** A chat changed without a message (read elsewhere, window update). */
  private onHubChat(chat: WaChat): void {
    const source = this.source();
    if (source?.kind === 'chat' && chat.id === source.chatId) this.chatInfo.set(chat);
  }

  private onHubStatus(e: WaMessageStatusEvent): void {
    if (!this.server().some((m) => m.id === e.messageId)) return;
    this.server.update((list) =>
      list.map((m) =>
        m.id === e.messageId
          ? {
              ...m,
              status: advanceStatus(m.status, e.status),
              deliveredAt: e.deliveredAt ?? m.deliveredAt,
              readAt: e.readAt ?? m.readAt,
              errorMessage: e.errorMessage ?? m.errorMessage,
            }
          : m,
      ),
    );
  }

  private belongs(chat: WaChat): boolean {
    const source = this.source();
    if (!source) return false;
    return source.kind === 'chat' ? chat.id === source.chatId : chat.customerId === source.customerId;
  }

  // ─────────────── internals: reading ───────────────

  private markReadOnOpen(): void {
    const source = this.source();
    if (source?.kind !== 'chat') return;
    // Unknown count (deep link) → mark anyway; it's cheap and idempotent.
    if (source.chat?.unreadCount === 0) return;
    if (this.focus.focused()) this.markRead();
    else this.unreadWhileAway = true;
  }

  private markRead(): void {
    const source = this.source();
    if (source?.kind !== 'chat' || this.forbidden()) return;
    this.unreadWhileAway = false;
    const chatId = source.chatId;
    const instanceId = this.instanceId();
    if (instanceId) this.session.noteChatRead({ id: chatId, instanceId });
    this.readSubject.next(chatId);
    // Best effort: a failure leaves the server badge; the next arrival retries.
    this.api
      .markChatRead(chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  // ─────────────── internals: sending ───────────────

  private dispatch(payload: OutgoingPayload, attempt: number): void {
    const source = this.source();
    if (source?.kind !== 'chat') return;
    const gen = this.generation;
    this.remember(payload);

    const onStored = (stored: WaMessage | null | undefined) => {
      if (gen !== this.generation) return;
      if (stored?.id) {
        this.upsertMany([stored]);
        this.sentSubject.next(stored);
      } else {
        this.refresh();
      }
    };
    const onError = (err: unknown) => {
      if (gen !== this.generation) return;
      this.onSendError(payload, attempt, err);
    };

    if (payload.file) {
      this.api
        .sendMedia({
          chatId: source.chatId,
          file: payload.file,
          caption: payload.text,
          clientMessageId: payload.clientMessageId,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (event) => {
            if (gen !== this.generation) return;
            if (event.kind === 'progress') this.patchPending(payload.clientMessageId, { uploadProgress: event.percent });
            else onStored(event.message);
          },
          error: onError,
        });
      return;
    }

    this.api
      .sendText({ target: { chatId: source.chatId }, text: payload.text, clientMessageId: payload.clientMessageId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: onStored, error: onError });
  }

  private onSendError(payload: OutgoingPayload, attempt: number, err: unknown): void {
    const transient = isTransientError(err);
    if (transient && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
      const gen = this.generation;
      timer(TRANSIENT_RETRY_DELAYS_MS[attempt])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => gen === this.generation && this.dispatch(payload, attempt + 1));
      return;
    }

    const reason = whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.sendFailed');
    const failed: OutgoingPayload = { ...payload, reuseIdOnRetry: transient };
    this.remember(failed);
    this.patchPending(payload.clientMessageId, {
      status: 'Failed',
      errorMessage: reason,
      uploadProgress: undefined,
      local: failed,
    });
    if (isPermissionError(err)) this.forbidden.set(true);
    // Nothing went out — offer the draft back (the host decides whether the composer takes it).
    if (isRejection(err)) {
      this.rejectedSubject.next({ clientMessageId: payload.clientMessageId, text: payload.text, file: payload.file, reason });
    }
  }

  /**
   * Insert / merge stored rows: dedupe by id, replace the optimistic bubble
   * with the same `clientMessageId`, keep ticks moving forward only.
   */
  private upsertMany(rows: readonly WaMessage[]): void {
    if (!rows.length) return;
    const byId = new Map(this.server().map((m) => [m.id, m]));
    /** clientMessageId → the stored row that confirms it. */
    const confirmed = new Map<string, WaMessage>();

    for (const row of rows) {
      const existing = byId.get(row.id);
      const merged = existing
        ? {
            ...existing,
            ...row,
            status: advanceStatus(existing.status, row.status),
            // A stale copy must not erase timestamps a status event already set.
            deliveredAt: row.deliveredAt ?? existing.deliveredAt,
            readAt: row.readAt ?? existing.readAt,
            errorMessage: row.errorMessage ?? existing.errorMessage,
          }
        : row;
      byId.set(row.id, merged);
      if (merged.clientMessageId) confirmed.set(merged.clientMessageId, merged);
    }
    this.server.set([...byId.values()].sort((a, b) => a.id - b.id));

    if (!confirmed.size) return;
    this.pending.update((list) => list.filter((m) => !m.clientMessageId || !confirmed.has(m.clientMessageId)));
    // Stored rows no longer need their payload; failed ones keep it for Retry.
    for (const [clientMessageId, stored] of confirmed) {
      if (stored.status !== 'Failed') this.forget(clientMessageId, true);
    }
  }

  private patchPending(clientMessageId: string, patch: Partial<ThreadMessage>): void {
    this.pending.update((list) => list.map((m) => (m.clientMessageId === clientMessageId ? { ...m, ...patch } : m)));
  }

  private optimistic(payload: OutgoingPayload): ThreadMessage {
    const source = this.source();
    const user = this.auth.currentUser();
    return {
      id: -Date.now() - Math.random(),
      chatId: source?.kind === 'chat' ? source.chatId : 0,
      externalMessageId: null,
      clientMessageId: payload.clientMessageId,
      direction: 'Outgoing',
      messageType: payload.file ? messageTypeForFile(payload.file) : 'text',
      text: payload.text || null,
      mediaUrl: payload.previewUrl,
      fileName: payload.file?.name ?? null,
      templateName: null,
      status: 'Pending',
      sentById: user?.userId ?? null,
      sentByName: user?.fullName?.trim() || user?.email || null,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      errorMessage: null,
      local: payload,
      uploadProgress: payload.file ? 0 : undefined,
    };
  }

  private remember(payload: OutgoingPayload): void {
    this.outbox.update((map) => new Map(map).set(payload.clientMessageId, payload));
  }

  private forget(clientMessageId: string, revokePreview: boolean): void {
    const payload = this.outbox().get(clientMessageId);
    if (!payload) return;
    // The bubble may still show the local preview until the stored media loads; revoke later.
    if (revokePreview && payload.previewUrl) {
      const url = payload.previewUrl;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    this.outbox.update((map) => {
      const next = new Map(map);
      next.delete(clientMessageId);
      return next;
    });
  }

  private revokeAll(): void {
    for (const payload of this.outbox().values()) {
      if (payload.previewUrl) URL.revokeObjectURL(payload.previewUrl);
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

function sameSource(a: ThreadSource | null, b: ThreadSource | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'chat' && b.kind === 'chat') return a.chatId === b.chatId;
  if (a.kind === 'customer' && b.kind === 'customer') return a.customerId === b.customerId;
  return false;
}
