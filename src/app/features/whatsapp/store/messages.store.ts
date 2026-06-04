import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ChatConversation,
  DeliveryStatus,
  MessageContentType,
  MessageDirection,
  MessageView,
  Pagination,
  SendResult,
  WaMessage,
} from '../models/message.model';
import { WhatsappMessagesService } from '../services/whatsapp-messages.service';
import { WhatsappSessionsService } from '../services/whatsapp-sessions.service';

const PAGE_SIZE = 25;
const RECONCILE_SKEW_MS = 15_000;
const META_KEY = 'crm_one_wa_chat_meta_v1';

const AVATAR_COLORS = [
  '#0066cc', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#14b8a6',
];

/** Per-session, per-conversation local metadata (no server read/favorite state). */
interface SessionMeta {
  favorites: string[];
  reads: Record<string, string>; // conversationId → ISO of last-read
}

/**
 * Conversation-aware signal store for a session's WhatsApp chats.
 *
 * The gateway has no chats endpoint, so conversations are derived client-side:
 * the flat `/sessions/{id}/messages` history is grouped by counterparty (the
 * side that isn't the session's own number, resolved from session status).
 * Read state and favorites have no server equivalent either, so they're kept
 * locally per session in `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class MessagesStore {
  private readonly api = inject(WhatsappMessagesService);
  private readonly sessions = inject(WhatsappSessionsService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly storage = inject(StorageService);

  private seq = 0;
  private readonly retryThunks = new Map<string, () => Observable<SendResult>>();

  // ─────────────── state ───────────────
  readonly sessionId = signal<number | null>(null);
  readonly selfNumber = signal<string | null>(null);

  private readonly serverRows = signal<WaMessage[]>([]);
  private readonly pending = signal<MessageView[]>([]);
  /** Conversations opened from "new chat" that have no messages yet. */
  private readonly drafts = signal<ChatConversation[]>([]);

  readonly activeId = signal<string | null>(null);
  readonly pagination = signal<Pagination | null>(null);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly listLoading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  private readonly favorites = signal<Set<string>>(new Set());
  private readonly reads = signal<Record<string, string>>({});

  // ─────────────── derived ───────────────

  /** All conversations newest-activity first. */
  readonly conversations = computed<ChatConversation[]>(() => {
    const self = this.selfNumber();
    const byId = new Map<string, MessageView[]>();
    for (const v of this.allViews()) {
      // A conversation keyed by our own number is a grouping artefact (e.g. a
      // self-addressed system row) — never a real chat partner.
      if (self && v.conversationId === self) continue;
      const list = byId.get(v.conversationId) ?? [];
      list.push(v);
      byId.set(v.conversationId, list);
    }

    const convos: ChatConversation[] = [];
    for (const [id, msgs] of byId) {
      msgs.sort((a, b) => this.time(a.createdAt) - this.time(b.createdAt));
      const last = msgs[msgs.length - 1];
      const readAt = this.reads()[id];
      const unread = msgs.filter(
        (m) => m.direction === 'in' && (!readAt || this.time(m.createdAt) > this.time(readAt)),
      ).length;
      convos.push(this.buildConversation(id, last, unread, msgs));
    }

    // Merge "new chat" drafts that have no messages yet.
    for (const d of this.drafts()) {
      if (!byId.has(d.id)) convos.push({ ...d, favorite: this.favorites().has(d.id) });
    }

    return convos.sort((a, b) => this.time(b.lastTime) - this.time(a.lastTime));
  });

  readonly activeConversation = computed<ChatConversation | null>(() => {
    const id = this.activeId();
    return id ? this.conversations().find((c) => c.id === id) ?? null : null;
  });

  /** Messages of the active conversation, oldest-first. */
  readonly messages = computed<MessageView[]>(() => {
    const id = this.activeId();
    if (!id) return [];
    return this.allViews()
      .filter((v) => v.conversationId === id)
      .sort((a, b) => this.time(a.createdAt) - this.time(b.createdAt));
  });

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + c.unread, 0),
  );

  readonly hasMore = computed(() => {
    const p = this.pagination();
    return !!p && p.current_page < p.last_page;
  });

  /** Recipient number for the send endpoints (active conversation). */
  readonly selectedConversation = computed(
    () => this.activeConversation()?.sendNumber ?? null,
  );

  // ─────────────── lifecycle ───────────────

  open(sessionId: number): void {
    this.sessionId.set(sessionId);
    this.serverRows.set([]);
    this.pending.set([]);
    this.drafts.set([]);
    this.activeId.set(null);
    this.pagination.set(null);
    this.error.set(null);
    this.selfNumber.set(null);
    this.retryThunks.clear();
    this.loadMeta(sessionId);
    this.resolveSelfNumber(sessionId);
    this.loadHistory(1, true);
  }

  reset(): void {
    this.sessionId.set(null);
    this.serverRows.set([]);
    this.pending.set([]);
    this.drafts.set([]);
    this.activeId.set(null);
    this.pagination.set(null);
    this.error.set(null);
    this.retryThunks.clear();
  }

  // ─────────────── conversations ───────────────

  selectConversation(id: string): void {
    this.activeId.set(id);
    this.markRead(id);
  }

  clearActive(): void {
    this.activeId.set(null);
  }

  /** Open (or focus) a conversation with an arbitrary number — the "new chat" flow. */
  startConversation(rawNumber: string): void {
    // Normalise to bare international digits: drop spaces/symbols/+, and the
    // `00` international prefix. The gateway's `to` expects a plain phone like
    // `201154113708` (proven to deliver) — never a `+`, never a LID.
    const sendNumber = rawNumber.replace(/\D/g, '').replace(/^00/, '');
    const id = sendNumber;
    if (!id) return;
    if (!this.conversations().some((c) => c.id === id)) {
      this.drafts.update((list) => [
        ...list,
        this.emptyConversation(id, sendNumber),
      ]);
    }
    this.selectConversation(id);
  }

  toggleFavorite(id: string): void {
    this.favorites.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    this.persistMeta();
  }

  // ─────────────── history ───────────────

  loadHistory(page = 1, replace = false): void {
    const id = this.sessionId();
    if (id == null) return;

    const first = page === 1;
    if (first && !replace) this.loading.set(true);
    else if (!first) this.loadingMore.set(true);
    this.error.set(null);

    this.api.history(id, page, PAGE_SIZE).subscribe({
      next: (res) => {
        this.serverRows.update((cur) => this.mergeRows(replace ? [] : cur, res.data ?? []));
        this.pagination.set(res.pagination ?? null);
        this.reconcilePending();
        this.loading.set(false);
        this.loadingMore.set(false);
        this.listLoading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadingMore.set(false);
        this.listLoading.set(false);
        const msg = this.errorText(err);
        this.error.set(msg);
        if (first) this.toast.error(msg);
      },
    });
  }

  loadMore(): void {
    const p = this.pagination();
    if (!p || p.current_page >= p.last_page || this.loadingMore()) return;
    this.loadHistory(p.current_page + 1, false);
  }

  /** Right-pane refresh — re-pull everything and regroup conversations. */
  refreshList(): void {
    this.listLoading.set(true);
    this.loadHistory(1, true);
  }

  /** Thread refresh — same source, keeps the active conversation in view. */
  refreshActive(): void {
    this.loadHistory(1, true);
  }

  // ─────────────── sending ───────────────

  sendText(message: string): void {
    const to = this.recipient();
    const body = message.trim();
    if (!to || !body) return;
    const view = this.optimistic('text', { text: body });
    this.dispatch(view, () => this.api.sendText(this.sessionId()!, { to, message: body }));
  }

  sendImage(imageUrl: string, caption: string, previewUrl?: string): void {
    const to = this.recipient();
    if (!to || !imageUrl) return;
    const view = this.optimistic('image', { text: caption, mediaUrl: previewUrl ?? imageUrl });
    this.dispatch(view, () =>
      this.api.sendImage(this.sessionId()!, { to, image_url: imageUrl, caption: caption || undefined }),
    );
  }

  sendVideo(videoUrl: string, caption: string, previewUrl?: string): void {
    const to = this.recipient();
    if (!to || !videoUrl) return;
    const view = this.optimistic('video', { text: caption, mediaUrl: previewUrl ?? videoUrl });
    this.dispatch(view, () =>
      this.api.sendVideo(this.sessionId()!, { to, video_url: videoUrl, caption: caption || undefined }),
    );
  }

  sendDocument(documentUrl: string, mimeType: string, filename: string): void {
    const to = this.recipient();
    if (!to || !documentUrl) return;
    const view = this.optimistic('document', {
      text: filename, mediaName: filename, mimeType, mediaUrl: documentUrl,
    });
    this.dispatch(view, () =>
      this.api.sendDocument(this.sessionId()!, {
        to, document_url: documentUrl, mime_type: mimeType, filename,
      }),
    );
  }

  sendAudio(audioUrl: string, previewUrl?: string): void {
    const to = this.recipient();
    if (!to || !audioUrl) return;
    const view = this.optimistic('audio', { mediaUrl: previewUrl ?? audioUrl });
    this.dispatch(view, () => this.api.sendAudio(this.sessionId()!, { to, audio_url: audioUrl }));
  }

  sendLocation(latitude: string, longitude: string, description: string): void {
    const to = this.recipient();
    if (!to || !latitude || !longitude) return;
    const view = this.optimistic('location', { text: description, latitude, longitude });
    this.dispatch(view, () =>
      this.api.sendLocation(this.sessionId()!, { to, latitude, longitude, description }),
    );
  }

  sendContact(contactName: string, contactPhone: string): void {
    const to = this.recipient();
    if (!to || !contactName || !contactPhone) return;
    const view = this.optimistic('contact', { text: contactName, contactName, contactPhone });
    this.dispatch(view, () =>
      this.api.sendContact(this.sessionId()!, {
        to, contact_name: contactName, contact_phone: contactPhone,
      }),
    );
  }

  retry(key: string): void {
    const build = this.retryThunks.get(key);
    if (build) this.fire(key, build);
  }

  // ─────────────── internals: sending ───────────────

  private dispatch(view: MessageView, build: () => Observable<SendResult>): void {
    this.retryThunks.set(view.key, build);
    this.pending.update((list) => [...list, view]);
    // A fresh conversation is no longer an empty draft once it has a message.
    this.drafts.update((list) => list.filter((d) => d.id !== view.conversationId));
    this.fire(view.key, build);
  }

  private fire(key: string, build: () => Observable<SendResult>): void {
    this.sending.set(true);
    this.error.set(null);
    this.updatePending(key, (m) => ({ ...m, failed: false, deliveryStatus: 'queued' }));
    build().subscribe({
      next: () => {
        this.sending.set(false);
        // Gateway accepted it (`queued`) → handed to WhatsApp = single grey
        // tick ("sent"). Advances to delivered/read when the history echo
        // carries `delivered_at` / `read_at`.
        this.updatePending(key, (m) => ({ ...m, deliveryStatus: 'sent' }));
        this.loadHistory(1, true);
      },
      error: (err) => {
        this.sending.set(false);
        const msg = this.errorText(err);
        this.error.set(msg);
        this.toast.error(msg);
        this.updatePending(key, (m) => ({ ...m, failed: true, deliveryStatus: 'failed' }));
      },
    });
  }

  private optimistic(type: MessageContentType, extra: Partial<MessageView>): MessageView {
    this.seq += 1;
    const conversationId = this.activeId() ?? '';
    return {
      key: `tmp-${Date.now()}-${this.seq}`,
      id: null,
      conversationId,
      direction: 'out',
      type,
      text: extra.text ?? '',
      deliveryStatus: 'queued',
      createdAt: new Date().toISOString(),
      optimistic: true,
      failed: false,
      ...extra,
    };
  }

  private updatePending(key: string, fn: (m: MessageView) => MessageView): void {
    this.pending.update((list) => list.map((m) => (m.key === key ? fn(m) : m)));
  }

  // ─────────────── internals: data ───────────────

  /** Server rows mapped to views, plus optimistic ones. */
  private allViews(): MessageView[] {
    const server = this.serverRows().map((m) => this.toView(m));
    return [...server, ...this.pending()];
  }

  private mergeRows(current: WaMessage[], incoming: WaMessage[]): WaMessage[] {
    const byId = new Map<number, WaMessage>();
    for (const m of current) byId.set(m.id, m);
    for (const m of incoming) byId.set(m.id, m);
    return [...byId.values()];
  }

  private reconcilePending(): void {
    const pending = this.pending();
    if (!pending.length) return;
    const serverOut = this.serverRows()
      .map((m) => this.toView(m))
      .filter((v) => v.direction === 'out' && v.id != null);
    const consumed = new Set<string>();

    const survivors = pending.filter((p) => {
      if (p.failed) return true;
      const match = serverOut.find((s) => {
        if (s.conversationId !== p.conversationId || consumed.has(s.key)) return false;
        const sameTime =
          this.time(s.createdAt) >= this.time(p.createdAt) - RECONCILE_SKEW_MS;
        const sameText = p.type === 'text' ? s.text === p.text : true;
        if (sameTime && sameText) {
          consumed.add(s.key);
          return true;
        }
        return false;
      });
      return !match;
    });

    if (survivors.length !== pending.length) this.pending.set(survivors);
  }

  private toView(m: WaMessage): MessageView {
    const { conversationId, direction } = this.classify(m);
    const isMedia = m.message === '[Media]';
    const deliveryStatus = this.deliveryOf(m);
    return {
      key: `srv-${m.id}`,
      id: m.id,
      conversationId,
      direction,
      type: isMedia ? 'document' : 'text',
      text: m.message ?? '',
      mediaPlaceholder: isMedia,
      deliveryStatus,
      createdAt: m.created_at,
      optimistic: false,
      failed: deliveryStatus === 'failed',
    };
  }

  /**
   * Real delivery state for an outgoing message. The gateway often leaves
   * `delivery_status` at `pending`/`queued` even after the message ships, and
   * signals progress through the timestamps + `whatsapp_message_id` instead —
   * so those take priority, otherwise the tick would be stuck on "queued".
   */
  private deliveryOf(m: WaMessage): DeliveryStatus {
    if (m.read_at) return 'read';
    if (m.delivered_at) return 'delivered';
    const ds = (m.delivery_status ?? '').toLowerCase();
    if (ds === 'failed') return 'failed';
    if (ds === 'read' || ds === 'delivered' || ds === 'sent') return ds;
    if (m.whatsapp_message_id) return 'sent';
    return 'queued';
  }

  /** Resolve a message's conversation key + direction relative to the session. */
  private classify(m: WaMessage): { conversationId: string; direction: MessageDirection } {
    const self = this.selfNumber();
    const fromKey = this.convKey(m.from);
    const toKey = this.convKey(m.to);

    if (self) {
      if (this.digits(m.from) === self) return { conversationId: toKey, direction: 'out' };
      if (this.digits(m.to) === self) return { conversationId: fromKey, direction: 'in' };
    }
    // Fallback when we don't know our own number: trust the status flag.
    return m.status === 'received'
      ? { conversationId: fromKey, direction: 'in' }
      : { conversationId: toKey, direction: 'out' };
  }

  private buildConversation(
    id: string,
    last: MessageView,
    unread: number,
    msgs: MessageView[],
  ): ChatConversation {
    const draft = this.drafts().find((d) => d.id === id);
    const sendNumber =
      draft?.sendNumber || this.sendNumberFor(msgs) || id;
    return {
      id,
      sendNumber,
      name: this.displayName(id),
      numberDisplay: this.displayName(id),
      avatarColor: this.colorFor(id),
      initials: this.initials(this.displayName(id)),
      lastText: last.mediaPlaceholder ? this.t('whatsapp.chat.media') : last.text,
      lastType: last.type,
      lastTime: last.createdAt,
      lastDirection: last.direction,
      lastStatus: last.deliveryStatus,
      unread,
      favorite: this.favorites().has(id),
    };
  }

  private emptyConversation(id: string, sendNumber: string): ChatConversation {
    return {
      id,
      sendNumber,
      name: this.displayName(id),
      numberDisplay: this.displayName(id),
      avatarColor: this.colorFor(id),
      initials: this.initials(this.displayName(id)),
      lastText: '',
      lastType: 'text',
      lastTime: new Date().toISOString(),
      lastDirection: 'out',
      lastStatus: 'queued',
      unread: 0,
      favorite: this.favorites().has(id),
    };
  }

  /** Best phone to send to: a numeric counterparty jid from the conversation. */
  private sendNumberFor(msgs: MessageView[]): string | null {
    const id = msgs[0]?.conversationId ?? '';
    return /^\d+$/.test(id) ? id : null;
  }

  // ─────────────── read state / favorites ───────────────

  private markRead(id: string): void {
    this.reads.update((map) => ({ ...map, [id]: new Date().toISOString() }));
    this.persistMeta();
  }

  private loadMeta(sessionId: number): void {
    const all = this.storage.getJson<Record<string, SessionMeta>>(META_KEY) ?? {};
    const meta = all[String(sessionId)] ?? { favorites: [], reads: {} };
    this.favorites.set(new Set(meta.favorites));
    this.reads.set(meta.reads ?? {});
  }

  private persistMeta(): void {
    const sessionId = this.sessionId();
    if (sessionId == null) return;
    const all = this.storage.getJson<Record<string, SessionMeta>>(META_KEY) ?? {};
    all[String(sessionId)] = {
      favorites: [...this.favorites()],
      reads: this.reads(),
    };
    this.storage.setJson(META_KEY, all);
  }

  // ─────────────── self-number ───────────────

  private resolveSelfNumber(sessionId: number): void {
    this.sessions.status(sessionId).subscribe({
      next: (status) => {
        const user = status.clientInfo?.wid?.user;
        if (user) this.selfNumber.set(this.digits(user));
      },
      error: () => {
        /* leave null — classify() falls back to the status flag */
      },
    });
  }

  // ─────────────── helpers ───────────────

  private recipient(): string | null {
    const to = this.selectedConversation();
    if (!to) {
      this.toast.warning(this.t('whatsapp.chat.recipientRequired'));
      return null;
    }
    return to;
  }

  private convKey(jid: string): string {
    const local = (jid ?? '').split('@')[0];
    const d = local.replace(/\D/g, '');
    return d || local.toLowerCase();
  }

  private digits(value: string): string {
    return (value ?? '').split('@')[0].replace(/\D/g, '');
  }

  private displayName(id: string): string {
    return /^\d+$/.test(id) ? `+${id}` : id;
  }

  private colorFor(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  private initials(name: string): string {
    const clean = name.replace(/^\+/, '').trim();
    if (/^\d+$/.test(clean)) return clean.slice(-2);
    const parts = clean.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '#';
  }

  private time(iso: string): number {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private errorText(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body: unknown = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const b = body as { message?: unknown; message_en?: unknown };
        if (typeof b.message === 'string' && b.message.trim()) return b.message;
        if (typeof b.message_en === 'string' && b.message_en.trim()) return b.message_en;
      }
    }
    return this.t('whatsapp.messages.genericError');
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
