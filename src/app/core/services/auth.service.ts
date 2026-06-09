import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, shareReplay, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { HttpCacheService } from './http-cache.service';
import {
  AuthResponseData,
  AuthTokens,
  LoginRequest,
  RefreshTokenRequest,
  User,
  UserRole,
} from '../models/auth.model';
import { ApiError } from '../models/api-response.model';
import { AppUser } from '../models/user.model';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import {
  withInlineHandling,
  withSkipAuth,
} from '../http/http-context.tokens';
import { getJwtExpiry } from '../utils/jwt.util';

/** Refresh this many ms BEFORE the access token actually expires. */
const REFRESH_BUFFER_MS = 60 * 1000;
/** Floor for the proactive refresh timer to avoid timer storms on edge cases. */
const MIN_REFRESH_DELAY_MS = 5_000;
/** Backoff after a transient (network/5xx) refresh failure. */
const REFRESH_RETRY_DELAY_MS = 30_000;
const BROADCAST_CHANNEL_NAME = 'crm-one-auth';

/**
 * Statuses that prove the refresh token itself is invalid — anything else
 * (network, CORS, 5xx) is treated as transient and triggers a backoff retry
 * instead of a forced logout.
 */
const AUTH_FATAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403]);

type CrossTabMessage =
  | { type: 'session-updated' }
  | { type: 'logged-out' };

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LogoutOptions {
  redirect?: boolean;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly httpCache = inject(HttpCacheService);

  private readonly currentUserSignal = signal<User | null>(this.loadStoredUser());
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly currentRole = computed<UserRole | null>(() => this.currentUserSignal()?.role ?? null);

  /** Shared in-flight refresh — prevents duplicate network calls. */
  private inflightRefresh: Observable<AuthTokens> | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.initCrossTabSync();
    if (this.isLoggedIn()) {
      this.scheduleProactiveRefresh();
      // Refresh profile fields (fullName/phone) on boot in case the user is
      // missing them from an older session or they changed server-side.
      this.hydrateProfile();
    }
  }

  // ──────────────────────── public API ────────────────────────

  login(input: LoginInput): Observable<User> {
    const payload: LoginRequest = {
      email: input.email.trim(),
      password: input.password,
    };

    return this.api
      .post<AuthResponseData>(API_ENDPOINTS.auth.login, payload, {
        context: withInlineHandling(withSkipAuth()),
      })
      .pipe(
        tap(() => this.httpCache.clear()),
        tap((data) => this.persistSession(data)),
        tap(() => this.hydrateProfile()),
        map((data) => this.toUser(data)),
      );
  }

  /**
   * Best-effort fetch of the full profile (fullName, phone) and merge into the
   * current user. The login endpoint only returns email/role/userId, so we
   * top up from `Auth/GetUserbyId` so the header can show fullName.
   * Failures are silent — the UI falls back to email.
   */
  private hydrateProfile(): void {
    const current = this.currentUserSignal();
    if (!current) return;

    this.api
      .get<AppUser>(API_ENDPOINTS.users.byId(current.userId), {
        context: withInlineHandling(),
      })
      .subscribe({
        next: (profile) => {
          const latest = this.currentUserSignal();
          if (!latest || latest.userId !== profile.userId) return;
          const merged: User = {
            ...latest,
            fullName: profile.fullName ?? latest.fullName ?? null,
            phone: profile.phone ?? latest.phone ?? null,
          };
          this.storage.setJson(environment.userKey, merged);
          this.currentUserSignal.set(merged);
        },
        error: () => {
          /* silent — header gracefully falls back to email */
        },
      });
  }

  logout(opts: LogoutOptions = {}): void {
    const { redirect = true, reason } = opts;
    this.clearLocalSession();
    this.broadcast({ type: 'logged-out' });

    if (reason) this.toast.warning(reason);
    if (redirect) this.router.navigate(['/auth/login']);
  }

  /**
   * Issues a refresh-token request, shared across concurrent callers. On
   * success the new tokens are persisted and the proactive timer is rescheduled.
   * On fatal failure the session is cleared and the user is redirected.
   */
  refreshToken(): Observable<AuthTokens> {
    if (this.inflightRefresh) return this.inflightRefresh;

    // Race shortcut: another tab may have already refreshed.
    const fromAnotherTab = this.readFreshTokens();
    if (fromAnotherTab) {
      this.scheduleProactiveRefresh();
      return of(fromAnotherTab);
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.scheduleSessionExpiredLogout();
      return throwError(() => this.makeAuthError('Missing refresh token'));
    }

    const payload: RefreshTokenRequest = { refreshToken };

    this.inflightRefresh = this.api
      .post<AuthResponseData>(API_ENDPOINTS.auth.refresh, payload, {
        context: withInlineHandling(withSkipAuth()),
      })
      .pipe(
        tap((data) => this.persistSession(data)),
        map((data) => this.extractTokens(data)),
        catchError((err) => {
          // Last-ditch race recovery: another tab might have refreshed
          // between our request being sent and the failure landing.
          const recovered = this.readFreshTokens();
          if (recovered) {
            this.scheduleProactiveRefresh();
            return of(recovered);
          }

          if (this.isAuthFatal(err)) {
            this.scheduleSessionExpiredLogout();
            return throwError(() => err);
          }

          // Transient — re-arm and let the user keep their session.
          this.scheduleRefreshRetry();
          return throwError(() => err);
        }),
        finalize(() => {
          this.inflightRefresh = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.inflightRefresh;
  }

  getAccessToken(): string | null {
    return this.storage.get(environment.tokenKey);
  }

  getRefreshToken(): string | null {
    return this.storage.get(environment.refreshTokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getRefreshToken() && !!this.currentUserSignal();
  }

  // ──────────────────────── persistence ────────────────────────

  private persistSession(data: AuthResponseData): void {
    this.storage.set(environment.tokenKey, data.accessToken);
    this.storage.set(environment.refreshTokenKey, data.refreshToken);

    const existing = this.currentUserSignal();
    const user: User = {
      ...this.toUser(data),
      fullName: existing?.fullName ?? null,
      phone: existing?.phone ?? null,
    };
    this.storage.setJson(environment.userKey, user);
    this.currentUserSignal.set(user);

    this.scheduleProactiveRefresh();
    this.broadcast({ type: 'session-updated' });
  }

  private clearLocalSession(): void {
    this.cancelRefreshTimer();
    this.storage.remove(environment.tokenKey);
    this.storage.remove(environment.refreshTokenKey);
    this.storage.remove(environment.userKey);
    this.currentUserSignal.set(null);
    this.toast.clear();
    this.httpCache.clear();
  }

  private loadStoredUser(): User | null {
    const user = this.storage.getJson<User>(environment.userKey);
    if (!user || !this.storage.get(environment.refreshTokenKey)) return null;
    return user;
  }

  private toUser(data: AuthResponseData): User {
    return { userId: data.userId, email: data.email, role: data.role };
  }

  private extractTokens(data: AuthResponseData): AuthTokens {
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  }

  // ──────────────────────── proactive refresh ────────────────────────

  private scheduleProactiveRefresh(): void {
    this.cancelRefreshTimer();

    const access = this.getAccessToken();
    const exp = getJwtExpiry(access);
    if (!exp) return;

    const delay = Math.max(MIN_REFRESH_DELAY_MS, exp - Date.now() - REFRESH_BUFFER_MS);

    // setTimeout outside Angular zone — we don't need change detection to tick
    // every minute just because we're waiting to refresh.
    this.zone.runOutsideAngular(() => {
      this.refreshTimerId = setTimeout(() => {
        this.zone.run(() => this.refreshToken().subscribe({ error: () => {} }));
      }, delay);
    });
  }

  private scheduleRefreshRetry(): void {
    this.cancelRefreshTimer();
    this.zone.runOutsideAngular(() => {
      this.refreshTimerId = setTimeout(() => {
        this.zone.run(() => this.refreshToken().subscribe({ error: () => {} }));
      }, REFRESH_RETRY_DELAY_MS);
    });
  }

  private scheduleSessionExpiredLogout(): void {
    // Defer so any in-flight retry observables can complete before redirect.
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.zone.run(() =>
          this.logout({ reason: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى' }),
        );
      }, 0);
    });
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  // ──────────────────────── cross-tab sync ────────────────────────

  private initCrossTabSync(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = (e) => this.onCrossTabMessage(e.data as CrossTabMessage);
    } catch {
      this.channel = null;
    }
  }

  private onCrossTabMessage(msg: CrossTabMessage): void {
    if (!msg) return;
    if (msg.type === 'logged-out') {
      // Mirror the wipe locally — but DON'T re-broadcast (would loop).
      this.cancelRefreshTimer();
      this.currentUserSignal.set(null);
      this.toast.clear();
      this.httpCache.clear();
      this.router.navigate(['/auth/login']);
    } else if (msg.type === 'session-updated') {
      // Refresh signal + reschedule timer based on the new token.
      const user = this.loadStoredUser();
      this.currentUserSignal.set(user);
      this.scheduleProactiveRefresh();
    }
  }

  private broadcast(msg: CrossTabMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      /* channel closed — ignore */
    }
  }

  /** Returns fresh tokens read from storage if the access token still has time. */
  private readFreshTokens(): AuthTokens | null {
    const access = this.getAccessToken();
    const refresh = this.getRefreshToken();
    if (!access || !refresh) return null;
    const exp = getJwtExpiry(access);
    if (!exp) return null;
    if (Date.now() < exp - REFRESH_BUFFER_MS) {
      return { accessToken: access, refreshToken: refresh };
    }
    return null;
  }

  // ──────────────────────── helpers ────────────────────────

  private isAuthFatal(err: unknown): boolean {
    const status = (err as ApiError | undefined)?.status ?? 0;
    return AUTH_FATAL_STATUSES.has(status);
  }

  private makeAuthError(message: string): ApiError {
    return { status: 401, message };
  }
}
