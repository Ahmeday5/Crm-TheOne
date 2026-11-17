import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, throwError } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import { CLIENT_PORTAL_GATEWAY } from '../data/client-portal.gateway';
import {
  PORTAL_LINK_PROBLEMS,
  PortalLinkError,
  PortalLinkProblem,
  PortalSessionResponse,
  StoredPortalSession,
} from '../models/portal-session.models';

const STORAGE_KEY = 'crm_one_portal_session';
/** Re-exchange this long before the JWT really expires. */
const REFRESH_SKEW_MS = 2 * 60_000;

/**
 * The client's session, opened from the private link (`/p/:token`) — no
 * username / password, ever.
 *
 * - The raw link token is kept on this device so an expired portal JWT is
 *   silently re-exchanged; the client never sees a sign-in screen.
 * - A PIN (when the link has one) is kept in memory only — after a reload
 *   the PIN pad shows again once the JWT expires.
 * - `fail()` ends the session and lands on the link-problem page, e.g. when
 *   the company revokes the link while it is open.
 */
@Injectable({ providedIn: 'root' })
export class PortalSessionService {
  private readonly gateway = inject(CLIENT_PORTAL_GATEWAY);
  private readonly router = inject(Router);

  private readonly state = signal<StoredPortalSession | null>(readStored());
  private pin: string | null = null;
  private refreshing$: Observable<StoredPortalSession> | null = null;

  readonly session = this.state.asReadonly();
  readonly isOpen = computed(() => !!this.state());
  readonly customer = computed(() => this.state()?.customer ?? null);
  readonly visitorName = computed(() => this.state()?.visitorName ?? null);
  /** Who the portal greets: the visitor's own name, else the customer. */
  readonly displayName = computed(() => this.visitorName() || this.customer()?.name || '');
  /** The link this device opened — for "open on another device" / re-entry. */
  readonly linkToken = computed(() => this.state()?.linkToken ?? null);

  /** Trades a link token for a session. Errors are `PortalLinkError`. */
  open(linkToken: string, options: { pin?: string | null; visitorName?: string | null } = {}): Observable<StoredPortalSession> {
    const visitorName = options.visitorName ?? (this.state()?.linkToken === linkToken ? this.visitorName() : null);
    return this.gateway
      .startSession({ token: linkToken, pin: options.pin ?? null, visitorName: visitorName?.trim() || null })
      .pipe(
        map((res) => this.store(linkToken, res)),
        map((s) => {
          this.pin = options.pin ?? null;
          return s;
        }),
        catchError((e: ApiError) => throwError(() => toLinkError(e))),
      );
  }

  /** Sets the name shown on the client's requests / comments (re-issues the session). */
  rename(visitorName: string | null): Observable<StoredPortalSession> {
    const token = this.linkToken();
    if (!token) return throwError(() => new PortalLinkError('no_link'));
    return this.open(token, { pin: this.pin, visitorName: visitorName?.trim() || null }).pipe(
      map((s) => {
        // An explicit "skip" clears the name the server may have remembered.
        if (!visitorName) this.state.update((cur) => (cur ? { ...cur, visitorName: null } : cur));
        return this.state() ?? s;
      }),
    );
  }

  /** The current portal JWT, or `null` when it must be re-exchanged first. */
  freshAccessToken(): string | null {
    const s = this.state();
    if (!s) return null;
    return Date.parse(s.expiresAt) - REFRESH_SKEW_MS > Date.now() ? s.accessToken : null;
  }

  /** One shared re-exchange, however many requests are waiting on it. */
  refresh(): Observable<StoredPortalSession> {
    const token = this.linkToken();
    if (!token) return throwError(() => new PortalLinkError('no_link'));
    if (!this.refreshing$) {
      this.refreshing$ = this.open(token, { pin: this.pin }).pipe(
        finalize(() => (this.refreshing$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshing$;
  }

  /** Ends the session because of `problem` and shows the matching page. */
  fail(problem: PortalLinkProblem, retryAfterSec: number | null = null): void {
    const token = this.linkToken();
    if (problem === 'pin_required' || problem === 'pin_invalid') {
      // Same link, needs its PIN again — back to the entry page's PIN pad.
      this.router.navigate(['/p', token ?? '']);
      return;
    }
    this.clear();
    this.router.navigate(['/portal/access'], {
      queryParams: { reason: problem, retryAfter: retryAfterSec ?? undefined },
      replaceUrl: true,
    });
  }

  /** "خروج" — forget this device's session (the link itself keeps working). */
  signOut(): void {
    this.clear();
    this.router.navigate(['/portal/access'], { queryParams: { reason: 'signed_out' }, replaceUrl: true });
  }

  private clear(): void {
    this.pin = null;
    this.state.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
  }

  private store(linkToken: string, res: PortalSessionResponse): StoredPortalSession {
    const session: StoredPortalSession = {
      linkToken,
      accessToken: res.accessToken,
      expiresAt: res.expiresAt,
      customer: res.customer,
      visitorName: res.visitorName,
      projectsCount: res.projectsCount,
    };
    this.state.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* storage blocked — the session lives for this tab only */
    }
    return session;
  }
}

function readStored(): StoredPortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredPortalSession) : null;
    return parsed?.linkToken && parsed.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

/** Maps any session failure to a `PortalLinkError` (contract `reason` → problem). */
export function toLinkError(e: unknown): PortalLinkError {
  if (e instanceof PortalLinkError) return e;
  const err = (e ?? {}) as Partial<ApiError>;
  const reason = err.reason ?? err.code;
  if (reason && (PORTAL_LINK_PROBLEMS as ReadonlyArray<string>).includes(reason)) {
    return new PortalLinkError(reason as PortalLinkProblem, err.retryAfterSec ?? null);
  }
  if (err.status === 429) return new PortalLinkError('rate_limited', err.retryAfterSec ?? null);
  if (err.status === 404) return new PortalLinkError('link_invalid');
  if (err.status === 410) return new PortalLinkError('link_revoked');
  return new PortalLinkError('network');
}
