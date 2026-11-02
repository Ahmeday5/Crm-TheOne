import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, Subscription, exhaustMap, finalize } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import { WhatsAppMessage, WhatsAppRecipient } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { pollWhileVisible } from '../utils/poll-while-visible.util';
import {
  WHATSAPP_MAX_TAKE,
  WHATSAPP_TAKE_STEP,
  WHATSAPP_THREAD_POLL_MS,
  isPermissionError,
  isOutgoing,
  mediaKindOf,
  messageTypeForFile,
  whatsappErrorText,
} from '../utils/whatsapp.util';

/**
 * Where a thread's messages come from — and who its replies go to. A chat's
 * `recipient` is `null` until the chat's details are known (e.g. a deep link
 * to a chat outside the loaded list): it can be read, not answered.
 */
export type ThreadSource =
  | { kind: 'chat'; chatId: number; recipient: WhatsAppRecipient | null }
  | { kind: 'customer'; customerId: number };

/** What the user asked to send — kept so a failed send can be retried as-is. */
interface LocalPayload {
  key: string;
  createdAt: number;
  text: string;
  file: File | null;
  /** Object URL for an image preview; revoked once the bubble goes away. */
  previewUrl: string | null;
}

/** A message as rendered: server rows, plus optimistic ones still in flight. */
export interface ThreadMessage extends WhatsAppMessage {
  /** Present only on optimistic messages the server hasn't confirmed. */
  local?: LocalPayload;
}

/** A server-side "Failed" copy must be this close in time to replace a local one. */
const RECONCILE_WINDOW_MS = 2 * 60_000;

/**
 * State for one WhatsApp conversation — the inbox's open chat or a
 * customer's WhatsApp tab. Provided per thread component, never at root.
 *
 * - Server rows are the source of truth for the latest `take` messages; a poll
 *   every 5 s (paused while the tab is hidden) replaces them wholesale.
 * - Sending is optimistic: the bubble appears at once with a 🕓, the send
 *   button stays locked until the API answers (Wavex delays 3–12 s on
 *   purpose), then the bubble is swapped for the stored message.
 * - A failed send stays as a red bubble with the reason and a retry, until the
 *   server's own "Failed" copy shows up on a later poll.
 * - Chat threads are marked read on open and whenever new incoming messages
 *   arrive while open.
 */
@Injectable()
export class WhatsAppThreadStore {
  private readonly api = inject(WhatsAppApiService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly source = signal<ThreadSource | null>(null);
  private readonly serverMessages = signal<WhatsAppMessage[]>([]);
  private readonly pending = signal<ThreadMessage[]>([]);
  private readonly take = signal(WHATSAPP_TAKE_STEP);

  /** First load of the current source. */
  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  /** A send is in flight — the composer's send button is locked meanwhile. */
  readonly sending = signal(false);
  /** Load failure text (the thread stays usable for sending). */
  readonly error = signal<string | null>(null);
  /** 401: this chat / customer isn't the caller's. Polling stops. */
  readonly forbidden = signal(false);

  readonly messages = computed<ThreadMessage[]>(() => [...this.serverMessages(), ...this.pending()]);
  /** The thread has someone to reply to and the caller is allowed to. */
  readonly canCompose = computed(() => {
    const source = this.source();
    if (!source || this.forbidden()) return false;
    return source.kind === 'customer' || !!source.recipient;
  });
  readonly isEmpty = computed(() => !this.loading() && this.messages().length === 0);

  /** The server returned a full window, so older messages may exist. */
  readonly canLoadOlder = computed(
    () => this.serverMessages().length >= this.take() && this.take() < WHATSAPP_MAX_TAKE,
  );
  /** We hold the API's maximum window — older history isn't reachable here. */
  readonly atHistoryLimit = computed(
    () => this.take() >= WHATSAPP_MAX_TAKE && this.serverMessages().length >= WHATSAPP_MAX_TAKE,
  );

  private readonly sentSubject = new Subject<WhatsAppMessage>();
  /** Each message the server confirmed as sent from this thread. */
  readonly sent$: Observable<WhatsAppMessage> = this.sentSubject.asObservable();

  /** Bumped on every `connect()`, so late responses for an old source are dropped. */
  private generation = 0;
  /** Request ordering: a response older than the last applied one is ignored. */
  private requestSeq = 0;
  private appliedSeq = 0;
  /** Highest incoming id already reported read for the current chat. */
  private lastReadIncomingId = 0;
  private localSeq = 0;
  private pollSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pollSub?.unsubscribe();
      this.clearPending();
    });
  }

  // ─────────────── lifecycle ───────────────

  /** Switch the thread to `source` (or detach with `null`). */
  connect(source: ThreadSource | null): void {
    if (sameSource(this.source(), source)) {
      // Same conversation; the recipient may have changed (phone → linked customer).
      if (source) this.source.set(source);
      return;
    }

    this.generation++;
    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.clearPending();
    this.source.set(source);
    this.serverMessages.set([]);
    this.take.set(WHATSAPP_TAKE_STEP);
    this.error.set(null);
    this.forbidden.set(false);
    this.sending.set(false);
    this.loadingOlder.set(false);
    this.lastReadIncomingId = 0;

    if (!source) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.fetch(true);
    this.startPolling();
  }

  /** Re-read now (e.g. a new-message notification just arrived). */
  refresh(): void {
    if (this.source() && !this.forbidden()) this.fetch(false);
  }

  /** "Show older": widen the window by one step (API max 200). */
  loadOlder(): void {
    if (this.loadingOlder() || !this.canLoadOlder()) return;
    this.take.update((n) => Math.min(WHATSAPP_MAX_TAKE, n + WHATSAPP_TAKE_STEP));
    this.loadingOlder.set(true);
    this.fetch(false);
  }

  // ─────────────── sending ───────────────

  /**
   * Sends text, or a file with `text` as its caption. Returns `false` when the
   * thread can't send right now (another send in flight, nothing to send).
   */
  send(text: string, file: File | null = null): boolean {
    const source = this.source();
    const recipient = source ? recipientOf(source) : null;
    const body = text.trim();
    if (!source || !recipient || this.forbidden() || this.sending() || (!body && !file)) return false;

    const local = this.buildLocal(body, file);
    this.pending.update((list) => [...list, local]);
    this.sending.set(true);

    const request$ = file
      ? this.api.sendMedia({ recipient, file, caption: body })
      : this.api.sendText({ recipient, text: body });
    const gen = this.generation;

    request$
      .pipe(
        finalize(() => {
          if (gen === this.generation) this.sending.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (stored) => {
          if (gen !== this.generation) return;
          this.dropPending(local.local!.key);
          if (stored?.id) {
            this.serverMessages.update((list) =>
              list.some((m) => m.id === stored.id) ? list : [...list, stored],
            );
            this.sentSubject.next(stored);
          } else {
            this.refresh();
          }
        },
        error: (err) => {
          if (gen !== this.generation) return;
          this.patchPending(local.local!.key, {
            status: 'Failed',
            errorMessage: whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.sendFailed'),
          });
          // A 400 is stored server-side as Failed; pull it so the copies reconcile.
          if (!isPermissionError(err)) this.refresh();
        },
      });

    return true;
  }

  /**
   * Retry a failed message: a local one is re-sent with its original payload
   * (file included); a server-side failure can be re-sent when it was text.
   */
  retry(message: ThreadMessage): boolean {
    if (this.sending()) return false;
    if (message.local) {
      const { key, text, file } = message.local;
      this.dropPending(key);
      return this.send(text, file);
    }
    return this.canRetry(message) ? this.send(message.text ?? '') : false;
  }

  canRetry(message: ThreadMessage): boolean {
    if (message.status !== 'Failed' || !isOutgoing(message)) return false;
    if (message.local) return true;
    return mediaKindOf(message.messageType) === 'text' && !!message.text?.trim();
  }

  // ─────────────── internals ───────────────

  private startPolling(): void {
    this.pollSub = pollWhileVisible(WHATSAPP_THREAD_POLL_MS)
      .pipe(
        exhaustMap(() => this.request()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private fetch(initial: boolean): void {
    this.request(initial).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /** One read of the current window; the result is applied in order. */
  private request(initial = false): Observable<void> {
    const source = this.source();
    const gen = this.generation;
    const seq = ++this.requestSeq;

    return new Observable<void>((subscriber) => {
      if (!source || this.forbidden()) {
        subscriber.complete();
        return;
      }
      const read$ =
        source.kind === 'chat'
          ? this.api.chatMessages(source.chatId, this.take())
          : this.api.customerMessages(source.customerId, this.take());

      return read$.subscribe({
        next: (rows) => {
          if (gen === this.generation && seq > this.appliedSeq) {
            this.appliedSeq = seq;
            this.apply(rows, initial);
          }
          subscriber.complete();
        },
        error: (err) => {
          if (gen === this.generation) this.onReadError(err, initial);
          subscriber.complete();
        },
      });
    });
  }

  private apply(rows: WhatsAppMessage[], initial: boolean): void {
    this.serverMessages.set(rows);
    this.loading.set(false);
    this.loadingOlder.set(false);
    this.error.set(null);
    this.reconcilePending(rows);
    this.markReadIfNeeded(rows, initial);
  }

  private onReadError(err: unknown, initial: boolean): void {
    this.loading.set(false);
    this.loadingOlder.set(false);
    if (isPermissionError(err)) {
      this.forbidden.set(true);
      this.pollSub?.unsubscribe();
      this.pollSub = null;
      return;
    }
    // A failed background poll keeps the last good view; only a first load reports.
    if (initial || this.serverMessages().length === 0) {
      this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.loadMessages'));
    }
  }

  /** Chat threads: report read on open, and again when new incoming messages land. */
  private markReadIfNeeded(rows: WhatsAppMessage[], initial: boolean): void {
    const source = this.source();
    if (source?.kind !== 'chat') return;

    const newestIncoming = rows.reduce(
      (max, m) => (isOutgoing(m) ? max : Math.max(max, m.id)),
      0,
    );
    if (!initial && newestIncoming <= this.lastReadIncomingId) return;
    this.lastReadIncomingId = Math.max(this.lastReadIncomingId, newestIncoming);
    // Best effort: a failure leaves the server badge, and the next arrival retries.
    this.api
      .markChatRead(source.chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  /** Drop local failures once the server's own "Failed" copy is in the window. */
  private reconcilePending(rows: WhatsAppMessage[]): void {
    const failedOnServer = rows.filter((m) => isOutgoing(m) && m.status === 'Failed');
    if (!failedOnServer.length) return;
    for (const local of this.pending()) {
      if (local.status !== 'Failed' || !local.local) continue;
      if (failedOnServer.some((m) => isServerCopyOf(m, local.local!))) this.dropPending(local.local.key);
    }
  }

  private buildLocal(text: string, file: File | null): ThreadMessage {
    const key = `local-${++this.localSeq}`;
    const isImage = !!file && file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file!) : null;
    const source = this.source();
    const user = this.auth.currentUser();

    return {
      id: -this.localSeq,
      chatId: source?.kind === 'chat' ? source.chatId : 0,
      direction: 'Outgoing',
      messageType: file ? messageTypeForFile(file) : 'text',
      text: text || null,
      mediaUrl: previewUrl,
      fileName: file?.name ?? null,
      status: 'Pending',
      sentById: user?.userId ?? null,
      sentByName: user?.fullName?.trim() || user?.email || null,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      errorMessage: null,
      local: { key, createdAt: Date.now(), text, file, previewUrl },
    };
  }

  private patchPending(key: string, patch: Partial<WhatsAppMessage>): void {
    this.pending.update((list) => list.map((m) => (m.local?.key === key ? { ...m, ...patch } : m)));
  }

  private dropPending(key: string): void {
    const target = this.pending().find((m) => m.local?.key === key);
    if (target?.local?.previewUrl) URL.revokeObjectURL(target.local.previewUrl);
    this.pending.update((list) => list.filter((m) => m.local?.key !== key));
  }

  private clearPending(): void {
    for (const m of this.pending()) {
      if (m.local?.previewUrl) URL.revokeObjectURL(m.local.previewUrl);
    }
    this.pending.set([]);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

function recipientOf(source: ThreadSource): WhatsAppRecipient | null {
  return source.kind === 'chat' ? source.recipient : { customerId: source.customerId };
}

function sameSource(a: ThreadSource | null, b: ThreadSource | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'chat' && b.kind === 'chat') return a.chatId === b.chatId;
  if (a.kind === 'customer' && b.kind === 'customer') return a.customerId === b.customerId;
  return false;
}

/** Same content, sent around the same time → the server's record of our send. */
function isServerCopyOf(server: WhatsAppMessage, local: LocalPayload): boolean {
  const at = parseUtc(server.sentAt)?.getTime() ?? 0;
  if (at < local.createdAt - RECONCILE_WINDOW_MS) return false;
  if (local.file) return server.fileName === local.file.name;
  return (server.text ?? '').trim() === local.text;
}
