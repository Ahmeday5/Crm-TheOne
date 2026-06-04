import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { whatsappOptions } from './whatsapp-http.util';
import {
  MessagesResponse,
  SendAudioRequest,
  SendContactRequest,
  SendDocumentRequest,
  SendImageRequest,
  SendLocationRequest,
  SendMessageResponse,
  SendResult,
  SendTextRequest,
  SendVideoRequest,
} from '../models/message.model';

/**
 * HTTP boundary for the WhatsApp Messages endpoints.
 *
 * Shares the gateway token + auth-skip + inline-handling options with the
 * sessions service (see `whatsapp-http.util`). History returns the paginated
 * envelope untouched; the send endpoints unwrap to their `SendResult`.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.whatsappApiUrl.replace(/\/+$/, '');

  // ─────────────── history ───────────────

  history(
    sessionId: number,
    page = 1,
    perPage = 25,
  ): Observable<MessagesResponse> {
    return this.http.get<MessagesResponse>(this.url(sessionId, 'messages'), {
      ...whatsappOptions(),
      params: { page, per_page: perPage },
    });
  }

  // ─────────────── send ───────────────

  sendText(sessionId: number, body: SendTextRequest): Observable<SendResult> {
    return this.post(sessionId, 'text', body);
  }

  sendImage(sessionId: number, body: SendImageRequest): Observable<SendResult> {
    return this.post(sessionId, 'image', body);
  }

  sendVideo(sessionId: number, body: SendVideoRequest): Observable<SendResult> {
    return this.post(sessionId, 'video', body);
  }

  sendDocument(
    sessionId: number,
    body: SendDocumentRequest,
  ): Observable<SendResult> {
    return this.post(sessionId, 'document', body);
  }

  sendAudio(sessionId: number, body: SendAudioRequest): Observable<SendResult> {
    return this.post(sessionId, 'audio', body);
  }

  sendLocation(
    sessionId: number,
    body: SendLocationRequest,
  ): Observable<SendResult> {
    return this.post(sessionId, 'location', body);
  }

  sendContact(
    sessionId: number,
    body: SendContactRequest,
  ): Observable<SendResult> {
    return this.post(sessionId, 'contact', body);
  }

  // ─────────────── internals ───────────────

  private post(
    sessionId: number,
    kind: string,
    body: unknown,
  ): Observable<SendResult> {
    return this.http
      .post<SendMessageResponse>(
        this.url(sessionId, `messages/${kind}`),
        body,
        whatsappOptions(),
      )
      .pipe(map((res) => res.data));
  }

  private url(sessionId: number, path: string): string {
    return `${this.base}/sessions/${sessionId}/${path}`;
  }
}
