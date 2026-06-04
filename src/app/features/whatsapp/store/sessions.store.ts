import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CreateSessionRequest,
  PairResponse,
  QrData,
  Session,
  SessionDetails,
  SessionHealthData,
  SessionHealthSummary,
  SessionStatusData,
} from '../models/session.model';
import { WhatsappSessionsService } from '../services/whatsapp-sessions.service';

/**
 * Signal store for the WhatsApp Sessions module.
 *
 * Owns every piece of UI state (list, selection, status, health, QR, loading,
 * error) and orchestrates the service: it flips loading flags, surfaces
 * success/error toasts, and exposes granular read methods the detail page
 * drives on a 5-second poll. Components stay declarative — they read signals
 * and call intent methods, never the HTTP layer directly.
 */
@Injectable({ providedIn: 'root' })
export class SessionsStore {
  private readonly api = inject(WhatsappSessionsService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);

  // ─────────────── state ───────────────
  readonly sessions = signal<Session[]>([]);
  readonly selectedSession = signal<SessionDetails | null>(null);
  readonly detailsHealth = signal<SessionHealthSummary | null>(null);
  readonly sessionStatus = signal<SessionStatusData | null>(null);
  readonly sessionHealth = signal<SessionHealthData | null>(null);
  readonly qrData = signal<QrData | null>(null);
  readonly pairingCode = signal<string | null>(null);

  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly pairing = signal(false);
  readonly error = signal<string | null>(null);

  // ─────────────── derived ───────────────

  /** True once any source reports the live connection is up. */
  readonly isConnected = computed(() => {
    const fromStatus = this.sessionStatus()?.status;
    const fromQr = this.qrData()?.status;
    const fromDetails = this.selectedSession()?.status;
    return (
      fromStatus === 'connected' ||
      fromQr === 'connected' ||
      fromDetails === 'connected'
    );
  });

  // ─────────────── list ───────────────

  loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  createSession(body: CreateSessionRequest): Observable<Session> {
    this.actionLoading.set(true);
    this.error.set(null);
    return this.api.create(body).pipe(
      tap({
        next: () => {
          this.actionLoading.set(false);
          this.toast.success(this.t('whatsapp.messages.created'));
          this.loadSessions();
        },
        error: (err) => this.fail(err),
      }),
    );
  }

  // ─────────────── details ───────────────

  loadDetails(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.details(id).subscribe({
      next: (res) => {
        this.selectedSession.set(res.data);
        this.detailsHealth.set(res.health ?? null);
        this.loading.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  loadStatus(id: number): void {
    this.api.status(id).subscribe({
      next: (status) => this.sessionStatus.set(status),
      error: () => {
        /* polling read — swallow transient errors, keep the last good value */
      },
    });
  }

  loadHealth(id: number): void {
    this.api.health(id).subscribe({
      next: (health) => this.sessionHealth.set(health),
      error: () => {
        /* polling read — keep last good value */
      },
    });
  }

  loadQr(id: number): void {
    this.api.qr(id).subscribe({
      next: (qr) => this.qrData.set(qr),
      error: () => {
        /* QR endpoint can 404 briefly while the session boots — ignore */
      },
    });
  }

  // ─────────────── pairing ───────────────

  pair(id: number, phoneNumber: string): void {
    this.pairing.set(true);
    this.error.set(null);
    this.pairingCode.set(null);
    this.api.pair(id, phoneNumber).subscribe({
      next: (res) => {
        this.pairing.set(false);
        const code = this.extractPairingCode(res);
        if (code) {
          this.pairingCode.set(code);
        } else if (res.data?.status === 'connected') {
          // Already linked — the dialog shows the connected state.
        } else {
          this.error.set(this.t('whatsapp.pair.noCode'));
        }
      },
      error: (err) => {
        this.pairing.set(false);
        this.error.set(this.errorText(err));
        this.toast.error(this.errorText(err));
      },
    });
  }

  /**
   * Pull the pairing code out of the response regardless of the exact field
   * name. Tries the documented keys, then any key mentioning "code"/"pair",
   * then a code-shaped token inside the message — covers the gateway's
   * variations without guessing wrongly (phone numbers / statuses are skipped).
   */
  private extractPairingCode(res: PairResponse): string | null {
    const fromObject = (obj: unknown): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      const rec = obj as Record<string, unknown>;
      for (const k of ['pairing_code', 'pairingCode', 'code', 'pair_code', 'pairCode']) {
        const v = rec[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      for (const [k, v] of Object.entries(rec)) {
        if (/code|pair/i.test(k) && typeof v === 'string') {
          const s = v.trim();
          // Skip phone-like all-digit values.
          if (s && !/^\d{7,}$/.test(s)) return s;
        }
      }
      return null;
    };

    let code = fromObject(res.data) ?? fromObject(res);
    if (!code) {
      const envelope = res as unknown as { message?: unknown; message_en?: unknown };
      const texts = [envelope.message, envelope.message_en].filter(
        (s): s is string => typeof s === 'string',
      );
      for (const text of texts) {
        const match = text.match(/\b([A-Z0-9]{4}-?[A-Z0-9]{4})\b/i);
        if (match) {
          code = match[1];
          break;
        }
      }
    }
    return code;
  }

  // ─────────────── lifecycle actions ───────────────

  start(id: number): void {
    this.runAction(this.api.start(id), id, 'whatsapp.messages.started');
  }

  stop(id: number): void {
    this.runAction(this.api.stop(id), id, 'whatsapp.messages.stopped');
  }

  restart(id: number): void {
    this.runAction(this.api.restart(id), id, 'whatsapp.messages.restarted');
  }

  /** Deletes a session; resolves true on success so the page can navigate away. */
  deleteSession(id: number): Observable<unknown> {
    this.actionLoading.set(true);
    this.error.set(null);
    return this.api.remove(id).pipe(
      tap({
        next: () => {
          this.actionLoading.set(false);
          this.toast.success(this.t('whatsapp.messages.deleted'));
          this.loadSessions();
        },
        error: (err) => this.fail(err),
      }),
    );
  }

  // ─────────────── housekeeping ───────────────

  /** Clears per-session state when leaving the details page. */
  resetDetails(): void {
    this.selectedSession.set(null);
    this.detailsHealth.set(null);
    this.sessionStatus.set(null);
    this.sessionHealth.set(null);
    this.qrData.set(null);
    this.pairingCode.set(null);
    this.error.set(null);
  }

  // ─────────────── internals ───────────────

  /** Run a fire-and-forget lifecycle action, then refresh details + status. */
  private runAction(
    action$: Observable<unknown>,
    id: number,
    successKey: string,
  ): void {
    this.actionLoading.set(true);
    this.error.set(null);
    action$.subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.toast.success(this.t(successKey));
        this.loadDetails(id);
        this.loadStatus(id);
        this.loadHealth(id);
      },
      error: (err) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    const message = this.errorText(err);
    this.loading.set(false);
    this.actionLoading.set(false);
    this.error.set(message);
    this.toast.error(message);
  }

  private errorText(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body: unknown = err.error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object') {
        const message = (body as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
      }
    }
    return this.t('whatsapp.messages.genericError');
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
