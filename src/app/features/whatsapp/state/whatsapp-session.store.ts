import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, debounceTime, exhaustMap, filter, switchMap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { WaChat, WaInstance, WaNumberStatus } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { pollWhileVisible } from '../utils/poll-while-visible.util';
import { canUseWhatsApp, isChannelActive, isWhatsAppChannel, whatsappErrorText } from '../utils/whatsapp.util';

/** Sidebar item the unread total is published on. */
const NAV_PATH = '/whatsapp';
/** While the hub is down, re-read the channel counters this often. */
const CHANNELS_FALLBACK_POLL_MS = 60_000;
/** Counter changes we can't compute locally are batched into one re-read. */
const RESYNC_DEBOUNCE_MS = 3_000;

/**
 * App-wide WhatsApp / Messenger state for the signed-in user (root, lives for the session):
 *
 * - `status`: the caller's own WhatsApp number (`GET /status`) — drives the
 *   header chip, the "new chat" button and the disconnected banner.
 * - `channels`: `GET /instances` — every channel for admins; for employees
 *   their own (at most one WhatsApp number + one Messenger page) — with
 *   chat / unread counters.
 * - `totalUnread`: sum of `unreadChatsCount`, published to the sidebar badge.
 *
 * Kept live from the hub: instance status events patch channels and the own
 * status; message / chat events move the unread counters (a chat that turns
 * unread adds one to its channel, a chat that is read removes one).
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppSessionStore {
  private readonly api = inject(WhatsAppApiService);
  private readonly realtime = inject(WhatsAppRealtimeService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly badges = inject(NavBadgesService);

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly enabled = computed(() => canUseWhatsApp(this.auth.currentRole()));

  // ── own number ──
  private readonly statusSignal = signal<WaNumberStatus | null>(null);
  readonly status = this.statusSignal.asReadonly();
  readonly statusLoading = signal(false);
  readonly statusError = signal<string | null>(null);

  // ── channels ──
  private readonly channelsSignal = signal<WaInstance[]>([]);
  readonly channels = this.channelsSignal.asReadonly();
  readonly channelsLoading = signal(false);
  readonly channelsLoaded = signal(false);
  readonly channelsError = signal<string | null>(null);

  readonly totalUnread = computed(() =>
    this.channelsSignal().reduce((sum, c) => sum + Math.max(0, c.unreadChatsCount || 0), 0),
  );

  /** The caller's own WhatsApp number (from `/instances`), else `null`. */
  readonly ownChannel = computed(() => {
    const id = this.statusSignal()?.instanceId;
    return id ? this.channelsSignal().find((c) => c.id === id) ?? null : null;
  });

  /** WhatsApp numbers that still exist on the provider (admin "send from" picker). */
  readonly whatsAppChannels = computed(() =>
    this.channelsSignal().filter((c) => isWhatsAppChannel(c) && isChannelActive(c)),
  );

  /**
   * The caller can start a new WhatsApp conversation: employees need an
   * assigned number (`GET /status` ≠ `NOT_ASSIGNED`); admins need any number.
   * Messenger can't start conversations, so a page alone doesn't count.
   */
  readonly hasWhatsAppNumber = computed(() => {
    const status = this.statusSignal();
    const assigned = !!status && status.status !== 'NOT_ASSIGNED';
    return this.isAdmin() ? assigned || this.whatsAppChannels().length > 0 : assigned;
  });

  /** Last unread count seen per chat — to tell "turned unread / read" transitions apart. */
  private readonly knownUnread = new Map<number, number>();
  /** Bumped on sign-out — responses for the previous session are dropped. */
  private session = 0;
  private readonly resync$ = new Subject<void>();

  constructor() {
    effect(
      () => {
        const active = this.enabled() ? this.auth.currentUser()?.userId : null;
        untracked(() => (active ? this.bootstrap() : this.reset()));
      },
      { allowSignalWrites: true },
    );

    effect(() => this.badges.set(NAV_PATH, this.totalUnread()), { allowSignalWrites: true });

    this.realtime.instanceStatus$.subscribe(({ instance }) => this.applyInstance(instance));
    this.realtime.message$
      .pipe(filter((e) => e.message.direction === 'Incoming'))
      .subscribe(({ instanceId, chat }) =>
        this.applyChatUnread({ ...chat, instanceId: instanceId || chat.instanceId }, true),
      );
    this.realtime.chatUpdated$.subscribe((chat) => this.applyChatUnread(chat, false));
    this.resync$.pipe(debounceTime(RESYNC_DEBOUNCE_MS)).subscribe(() => this.loadChannels());
    this.realtime.reconnected$.subscribe(() => {
      this.loadStatus();
      this.loadChannels();
    });

    // Safety net: while the hub is down, keep the badges roughly fresh.
    toObservable(this.realtime.state)
      .pipe(
        switchMap((state) =>
          state === 'reconnecting' ? pollWhileVisible(CHANNELS_FALLBACK_POLL_MS) : EMPTY,
        ),
        exhaustMap(() => {
          const session = this.session;
          return this.api.instances().pipe(
            // A response that lands after sign-out belongs to the previous user.
            filter(() => session === this.session),
            catchError(() => EMPTY),
          );
        }),
      )
      .subscribe((list) => this.channelsSignal.set(list));
  }

  // ─────────────── reads ───────────────

  loadStatus(): void {
    const session = this.session;
    this.statusLoading.set(true);
    this.statusError.set(null);
    this.api.status().subscribe({
      next: (status) => {
        if (session !== this.session) return;
        this.statusLoading.set(false);
        this.statusSignal.set(status);
      },
      error: (err) => {
        if (session !== this.session) return;
        this.statusLoading.set(false);
        this.statusError.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.number.unavailable'));
      },
    });
  }

  /** `GET /instances` also re-syncs the numbers with the provider. */
  loadChannels(): void {
    const session = this.session;
    this.channelsLoading.set(true);
    this.channelsError.set(null);
    this.api.instances().subscribe({
      next: (list) => {
        if (session !== this.session) return;
        this.channelsLoading.set(false);
        this.channelsLoaded.set(true);
        this.channelsSignal.set(list);
      },
      error: (err) => {
        if (session !== this.session) return;
        this.channelsLoading.set(false);
        this.channelsLoaded.set(true);
        this.channelsError.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.channels.loadFailed'));
      },
    });
  }

  channel(instanceId: string | null | undefined): WaInstance | null {
    return instanceId ? this.channelsSignal().find((c) => c.id === instanceId) ?? null : null;
  }

  /**
   * Whether a message can go out from `instanceId` right now. An unknown
   * channel is let through — the backend has the final word either way.
   */
  canSendFrom(instanceId: string | null | undefined): boolean {
    const channel = this.channel(instanceId);
    if (channel) return channel.canSend && isChannelActive(channel);
    const own = this.statusSignal();
    if (!this.isAdmin() && own?.instanceId && own.instanceId === instanceId) return own.canSend;
    return true;
  }

  // ─────────────── live updates ───────────────

  /** A channel's state changed (hub event, assignment). */
  applyInstance(instance: WaInstance): void {
    this.channelsSignal.update((list) => {
      const i = list.findIndex((c) => c.id === instance.id);
      if (i >= 0) return list.map((c, idx) => (idx === i ? { ...c, ...instance } : c));
      // The server only sends employees events for their own channels; admins see every channel.
      return [...list, instance];
    });

    const own = this.statusSignal();
    if (own?.instanceId === instance.id) {
      this.statusSignal.set({
        ...own,
        name: instance.name,
        phoneNumber: instance.phoneNumber,
        status: instance.status,
        canSend: instance.canSend,
        requiresRelink: instance.requiresRelink,
      });
    }
  }

  /**
   * Seed the unread record from a loaded chat page. Chats already tracked
   * are left alone: hub events keep them exact, while a page may be older.
   */
  noteChats(chats: readonly WaChat[]): void {
    for (const c of chats) {
      if (!this.knownUnread.has(c.id)) this.knownUnread.set(c.id, c.unreadCount || 0);
    }
  }

  /** The user just read this chat here (optimistic — the hub confirms with `chatUpdated`). */
  noteChatRead(chat: Pick<WaChat, 'id' | 'instanceId'>): void {
    this.applyChatUnread({ id: chat.id, instanceId: chat.instanceId, unreadCount: 0 }, false);
  }

  /** `incoming`: the update is a new incoming message (so the count just went up by one). */
  private applyChatUnread(chat: Pick<WaChat, 'id' | 'instanceId' | 'unreadCount'>, incoming: boolean): void {
    const next = chat.unreadCount || 0;
    const known = this.knownUnread.get(chat.id);
    this.knownUnread.set(chat.id, next);
    // Unknown chat: only a new incoming message tells its previous state
    // (1 unread = it just turned unread, more = it already was). Anything else → ask the server.
    if (known === undefined && !incoming) {
      this.resync$.next();
      return;
    }
    const prev = known ?? (next > 1 ? next : 0);

    const delta = Number(next > 0) - Number(prev > 0);
    if (!delta) return;
    this.channelsSignal.update((list) =>
      list.map((c) =>
        c.id === chat.instanceId ? { ...c, unreadChatsCount: Math.max(0, (c.unreadChatsCount || 0) + delta) } : c,
      ),
    );
  }

  // ─────────────── internals ───────────────

  private bootstrap(): void {
    this.loadStatus();
    this.loadChannels();
  }

  private reset(): void {
    this.session++;
    this.statusSignal.set(null);
    this.channelsSignal.set([]);
    this.channelsLoaded.set(false);
    this.statusError.set(null);
    this.channelsError.set(null);
    this.knownUnread.clear();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
