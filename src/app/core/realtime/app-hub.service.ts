import { Injectable, NgZone, computed, effect, inject, signal, untracked } from '@angular/core';
import type { HubConnection, IRetryPolicy, RetryContext } from '@microsoft/signalr';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { AuthService } from '../services/auth.service';
import { isJwtExpired } from '../utils/jwt.util';

export type HubState = 'stopped' | 'connecting' | 'connected' | 'reconnecting';

/** Reconnect forever with capped exponential backoff + jitter (0 s, 2 s, 4 s … 30 s). */
const RETRY_POLICY: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }: RetryContext) => {
    if (previousRetryCount === 0) return 0;
    const base = Math.min(30_000, 1_000 * 2 ** previousRetryCount);
    return base + Math.floor(Math.random() * 1_000);
  },
};

/** API origin without the `/api` suffix — hubs are mapped at the app root. */
const HUB_URL = `${environment.apiUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '')}/${API_ENDPOINTS.realtime.appHub}`;

/**
 * The app-wide SignalR connection to `/hubs/app` (announcements, team chat
 * and any future server push share it).
 *
 * - Connects for any signed-in user, stops on logout, and reconnects with
 *   the fresh token after a refresh (the hub authenticates at connect time).
 * - The SignalR client is lazy-loaded and shared with the WhatsApp hub chunk.
 * - Reconnects forever; the first `start()` is retried with the same policy
 *   (SignalR's automatic reconnect only covers drops after a start).
 * - Features subscribe by event name with `on<T>(name)`; handlers survive
 *   reconnects and are registered on every new connection.
 * - `reconnected$` fires after any gap so features refetch what they missed.
 */
@Injectable({ providedIn: 'root' })
export class AppHubService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  private connection: HubConnection | null = null;
  private signalr: typeof import('@microsoft/signalr') | null = null;
  /** Generation whose SignalR chunk is still loading — a second start() waits for it. */
  private loadingGen: number | null = null;
  private startAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every stop — late callbacks from an old connection are ignored. */
  private generation = 0;
  private hadConnection = false;

  /** One subject per event name, shared by every subscriber. */
  private readonly channels = new Map<string, Subject<unknown>>();

  private readonly stateSignal = signal<HubState>('stopped');
  readonly state = this.stateSignal.asReadonly();
  readonly connected = computed(() => this.stateSignal() === 'connected');

  private readonly reconnectedSubject = new Subject<void>();
  /** Connected again after a drop / restart — refetch what is on screen. */
  readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();

  constructor() {
    const userId = computed(() => this.auth.currentUser()?.userId ?? null);
    effect(
      () => {
        const id = userId();
        untracked(() => (id ? this.start() : this.stop()));
      },
      { allowSignalWrites: true },
    );

    this.auth.accessTokenChanged$.subscribe(() => {
      if (this.connection) this.restart();
    });
  }

  /**
   * Server-pushed `event` as a hot observable (emits inside the Angular
   * zone). Subscribing never opens a connection by itself — the hub follows
   * the session — so it is safe to call from any root service.
   */
  on<T>(event: string): Observable<T> {
    let subject = this.channels.get(event);
    if (!subject) {
      subject = new Subject<unknown>();
      this.channels.set(event, subject);
      this.attach(event);
    }
    return subject.asObservable() as Observable<T>;
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
    for (const event of this.channels.keys()) this.attach(event);
    this.startAttempt = 0;
    this.connect(gen);
  }

  /** Wires one event onto the current connection (no-op until it exists). */
  private attach(event: string): void {
    const connection = this.connection;
    const subject = this.channels.get(event);
    if (!connection || !subject) return;
    const gen = this.generation;
    connection.on(event, (payload: unknown) => this.emit(gen, () => subject.next(payload)));
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

  /** New connection, same session: features still get `reconnected$` for the gap. */
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
          // Anything loaded while the hub was unreachable may have missed events.
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
