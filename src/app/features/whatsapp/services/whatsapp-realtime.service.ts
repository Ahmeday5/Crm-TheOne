import { Injectable, NgZone, computed, effect, inject, signal, untracked } from '@angular/core';
import type { HubConnection, IRetryPolicy, RetryContext } from '@microsoft/signalr';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { AuthService } from '../../../core/services/auth.service';
import { isJwtExpired } from '../../../core/utils/jwt.util';
import { WaChat, WaInstanceStatusEvent, WaMessageEvent, WaMessageStatusEvent } from '../models/whatsapp.models';
import { canUseWhatsApp } from '../utils/whatsapp.util';

export type WaRealtimeState = 'stopped' | 'connecting' | 'connected' | 'reconnecting';

/** Hub event names — the server pushes these; there are no client methods to call. */
const HUB_EVENTS = {
  message: 'whatsappMessage',
  messageStatus: 'whatsappMessageStatus',
  chatUpdated: 'whatsappChatUpdated',
  instanceStatus: 'whatsappInstanceStatus',
} as const;

/** Reconnect forever with capped exponential backoff + jitter (0 s, 2 s, 4 s … 30 s). */
const RETRY_POLICY: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }: RetryContext) => {
    if (previousRetryCount === 0) return 0;
    const base = Math.min(30_000, 1_000 * 2 ** previousRetryCount);
    return base + Math.floor(Math.random() * 1_000);
  },
};

/** API origin without the `/api` suffix — the hub is mapped at the app root. */
const HUB_URL = `${environment.apiUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '')}/${API_ENDPOINTS.whatsapp.hub}`;

/**
 * The single SignalR connection to `/hubs/whatsapp`.
 *
 * - The SignalR client is lazy-loaded, so roles without WhatsApp never
 *   download it.
 * - Starts by itself once a WhatsApp role (Admin / Sales / Support) is signed
 *   in, stops on logout, and restarts with the new token after a refresh.
 * - Reconnects forever; the first `start()` is retried with the same policy
 *   (SignalR's automatic reconnect only covers drops after a start).
 * - The server decides who receives what (admins: everything; employees:
 *   their own number). Events are re-emitted as plain observables.
 * - `reconnected$` fires after any gap, so views refetch what they may have missed.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  private connection: HubConnection | null = null;
  /** The lazily loaded SignalR module (once loaded). */
  private signalr: typeof import('@microsoft/signalr') | null = null;
  /** Generation whose SignalR chunk is still loading — a second start() waits for it. */
  private loadingGen: number | null = null;
  private startAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every stop — late callbacks from an old connection are ignored. */
  private generation = 0;
  private hadConnection = false;

  private readonly stateSignal = signal<WaRealtimeState>('stopped');
  readonly state = this.stateSignal.asReadonly();
  readonly connected = computed(() => this.stateSignal() === 'connected');

  private readonly messageSubject = new Subject<WaMessageEvent>();
  private readonly statusSubject = new Subject<WaMessageStatusEvent>();
  private readonly chatSubject = new Subject<WaChat>();
  private readonly instanceSubject = new Subject<WaInstanceStatusEvent>();
  private readonly reconnectedSubject = new Subject<void>();

  /** A new incoming or outgoing message (also from the phone or another admin). */
  readonly message$: Observable<WaMessageEvent> = this.messageSubject.asObservable();
  readonly messageStatus$: Observable<WaMessageStatusEvent> = this.statusSubject.asObservable();
  /** A chat changed without a new message (e.g. unread reset). */
  readonly chatUpdated$: Observable<WaChat> = this.chatSubject.asObservable();
  readonly instanceStatus$: Observable<WaInstanceStatusEvent> = this.instanceSubject.asObservable();
  /** Connected again after a drop / restart — refetch what is on screen. */
  readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();

  constructor() {
    const eligibleUser = computed(() => {
      const user = this.auth.currentUser();
      return user && canUseWhatsApp(user.role) ? user.userId : null;
    });

    effect(
      () => {
        const userId = eligibleUser();
        untracked(() => (userId ? this.start() : this.stop()));
      },
      { allowSignalWrites: true },
    );

    // A refreshed token: reconnect with it (the hub authenticates at connect time).
    this.auth.accessTokenChanged$.subscribe(() => {
      if (this.connection) this.restart();
    });
  }

  // ─────────────── lifecycle ───────────────

  private start(): void {
    if (this.connection || this.loadingGen === this.generation) return;
    const gen = ++this.generation;
    this.loadingGen = gen;
    this.stateSignal.set(this.hadConnection ? 'reconnecting' : 'connecting');

    import('@microsoft/signalr')
      .then((signalr) => {
        if (gen !== this.generation) return;
        this.loadingGen = null;
        this.build(signalr, gen);
      })
      .catch(() => {
        if (gen !== this.generation) return;
        // The chunk failed to load (offline, new deploy) — try again shortly.
        this.loadingGen = null;
        this.stateSignal.set('reconnecting');
        this.zone.runOutsideAngular(() => {
          this.retryTimer = setTimeout(() => this.zone.run(() => this.start()), 30_000);
        });
      });
  }

  private build(signalr: typeof import('@microsoft/signalr'), gen: number): void {
    this.signalr = signalr;
    const connection = new signalr.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => this.accessToken() })
      .withAutomaticReconnect(RETRY_POLICY)
      .configureLogging(environment.production ? signalr.LogLevel.Error : signalr.LogLevel.Warning)
      .build();

    connection.on(HUB_EVENTS.message, (e: WaMessageEvent) => this.emit(gen, () => this.messageSubject.next(e)));
    connection.on(HUB_EVENTS.messageStatus, (e: WaMessageStatusEvent) =>
      this.emit(gen, () => this.statusSubject.next(e)),
    );
    connection.on(HUB_EVENTS.chatUpdated, (e: WaChat) => this.emit(gen, () => this.chatSubject.next(e)));
    connection.on(HUB_EVENTS.instanceStatus, (e: WaInstanceStatusEvent) =>
      this.emit(gen, () => this.instanceSubject.next(e)),
    );

    connection.onreconnecting(() => this.emit(gen, () => this.stateSignal.set('reconnecting')));
    connection.onreconnected(() =>
      this.emit(gen, () => {
        this.stateSignal.set('connected');
        this.reconnectedSubject.next();
      }),
    );
    // Only reached when the automatic reconnect gives up — start over.
    connection.onclose(() => this.emit(gen, () => this.scheduleStart(gen)));

    this.connection = connection;
    this.startAttempt = 0;
    this.connect(gen);
  }

  private stop(): void {
    this.generation++;
    this.clearRetry();
    const connection = this.connection;
    this.connection = null;
    this.hadConnection = false;
    this.stateSignal.set('stopped');
    connection?.stop().catch(() => undefined);
  }

  /** New connection, same session: views still get `reconnected$` for the gap. */
  private restart(): void {
    const hadConnection = this.hadConnection;
    this.stop();
    this.hadConnection = hadConnection;
    this.start();
  }

  private connect(gen: number): void {
    const connection = this.connection;
    if (!connection || gen !== this.generation) return;
    if (connection.state !== this.signalr?.HubConnectionState.Disconnected) return;

    this.stateSignal.set(this.hadConnection ? 'reconnecting' : 'connecting');
    connection
      .start()
      .then(() =>
        this.emit(gen, () => {
          // Views loaded while the hub was unreachable (or during a restart) may have missed events.
          const afterGap = this.hadConnection || this.startAttempt > 0;
          this.startAttempt = 0;
          this.stateSignal.set('connected');
          if (afterGap) this.reconnectedSubject.next();
          this.hadConnection = true;
        }),
      )
      .catch(() => this.emit(gen, () => this.scheduleStart(gen)));
  }

  private scheduleStart(gen: number): void {
    if (gen !== this.generation || !this.connection) return;
    this.stateSignal.set('reconnecting');
    this.clearRetry();
    const delay = RETRY_POLICY.nextRetryDelayInMilliseconds({
      previousRetryCount: ++this.startAttempt,
      elapsedMilliseconds: 0,
      retryReason: new Error('start failed'),
    })!;
    this.zone.runOutsideAngular(() => {
      this.retryTimer = setTimeout(() => this.zone.run(() => this.connect(gen)), delay);
    });
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** Runs a hub callback in the Angular zone, unless it belongs to a stopped connection. */
  private emit(gen: number, fn: () => void): void {
    if (gen !== this.generation) return;
    this.zone.run(fn);
  }

  /** A valid token for (re)connecting — refreshed first when it has already expired. */
  private async accessToken(): Promise<string> {
    const token = this.auth.getAccessToken();
    if (token && !isJwtExpired(token)) return token;
    try {
      return (await firstValueFrom(this.auth.refreshToken())).accessToken;
    } catch {
      return token ?? '';
    }
  }
}
