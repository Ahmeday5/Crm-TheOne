import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { whatsappOptions } from './whatsapp-http.util';
import {
  ActionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  PairResponse,
  QrData,
  QrResponse,
  Session,
  SessionDetailsResponse,
  SessionHealthData,
  SessionHealthResponse,
  SessionStatusData,
  SessionStatusResponse,
  SessionsResponse,
} from '../models/session.model';

/**
 * HTTP boundary for the WhatsApp Sessions gateway.
 *
 * All calls target `environment.whatsappApiUrl` — a separate host from the
 * main CRM API. The shared `authInterceptor` still attaches the bearer token
 * (it runs for every request), so no auth wiring lives here.
 *
 * Every request opts into `withInlineHandling()`: the global page loader and
 * the error-toast interceptor stand down so the `SessionsStore` owns loading,
 * error and success feedback. Methods unwrap the `{ success, data }` envelope
 * and return strongly-typed payloads.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappSessionsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.whatsappApiUrl.replace(/\/+$/, '');

  // ─────────────── reads ───────────────

  list(): Observable<Session[]> {
    return this.http
      .get<SessionsResponse>(this.url('/sessions'), this.opts())
      .pipe(map((res) => res.data ?? []));
  }

  /** Full details response — keeps the sibling `health` block intact. */
  details(id: number): Observable<SessionDetailsResponse> {
    return this.http.get<SessionDetailsResponse>(
      this.url(`/sessions/${id}`),
      this.opts(),
    );
  }

  qr(id: number): Observable<QrData> {
    return this.http
      .get<QrResponse>(this.url(`/sessions/${id}/qr`), this.opts())
      .pipe(map((res) => res.data));
  }

  status(id: number): Observable<SessionStatusData> {
    return this.http
      .get<SessionStatusResponse>(this.url(`/sessions/${id}/status`), this.opts())
      .pipe(map((res) => res.data));
  }

  health(id: number): Observable<SessionHealthData> {
    return this.http
      .get<SessionHealthResponse>(this.url(`/sessions/${id}/health`), this.opts())
      .pipe(map((res) => res.data));
  }

  // ─────────────── mutations ───────────────

  create(body: CreateSessionRequest): Observable<Session> {
    return this.http
      .post<CreateSessionResponse>(this.url('/sessions'), body, this.opts())
      .pipe(map((res) => res.data));
  }

  /**
   * Returns the FULL envelope (not just `data`) — the gateway's pairing-code
   * field name varies, so the store scans the whole response for it.
   */
  pair(id: number, phoneNumber: string): Observable<PairResponse> {
    return this.http.post<PairResponse>(
      this.url(`/sessions/${id}/pair`),
      { phone_number: phoneNumber },
      this.opts(),
    );
  }

  start(id: number): Observable<ActionResponse> {
    return this.http.post<ActionResponse>(
      this.url(`/sessions/${id}/start`),
      {},
      this.opts(),
    );
  }

  stop(id: number): Observable<ActionResponse> {
    return this.http.post<ActionResponse>(
      this.url(`/sessions/${id}/stop`),
      {},
      this.opts(),
    );
  }

  restart(id: number): Observable<ActionResponse> {
    return this.http.post<ActionResponse>(
      this.url(`/sessions/${id}/restart`),
      {},
      this.opts(),
    );
  }

  remove(id: number): Observable<ActionResponse> {
    return this.http.delete<ActionResponse>(
      this.url(`/sessions/${id}`),
      this.opts(),
    );
  }

  // ─────────────── internals ───────────────

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  /** WhatsApp token + skip CRM auth + store-owned loading/errors. */
  private opts() {
    return whatsappOptions();
  }
}
