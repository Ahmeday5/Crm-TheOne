import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { WaChat, WaInstance, WaInstanceStatusEvent, WaMessage, WaMessageEvent, WaMessageStatusEvent } from '../models/whatsapp.models';
import { WaRealtimeState } from '../services/whatsapp-realtime.service';

/** Test-only builders and fakes for the WhatsApp feature (imported by specs only). */

export function makeChat(patch: Partial<WaChat> = {}): WaChat {
  return {
    id: 1,
    instanceId: '217',
    instanceName: 'shahd Shereef',
    instancePhoneNumber: null,
    channelType: 'whatsapp_cloud',
    ownerUserId: 'u-1',
    ownerName: 'Shahd',
    phone: '201124612772',
    contactName: 'Ahmed',
    customerId: null,
    customerName: null,
    companyName: null,
    lastMessageAt: '2026-11-12T10:00:00Z',
    lastMessagePreview: 'hello',
    unreadCount: 0,
    canReply: true,
    // Relative to the real clock: the window is comfortably open whenever the tests run.
    replyWindowEndsAt: new Date(Date.now() + 10 * 3_600_000).toISOString(),
    canSendTemplate: true,
    ...patch,
  };
}

export function makeMessage(patch: Partial<WaMessage> = {}): WaMessage {
  return {
    id: 100,
    chatId: 1,
    externalMessageId: null,
    clientMessageId: null,
    direction: 'Incoming',
    messageType: 'text',
    text: 'hi',
    mediaUrl: null,
    fileName: null,
    templateName: null,
    status: 'Received',
    sentById: null,
    sentByName: null,
    sentAt: '2026-11-12T10:00:00Z',
    deliveredAt: null,
    readAt: null,
    errorMessage: null,
    ...patch,
  };
}

export function makeChannel(patch: Partial<WaInstance> = {}): WaInstance {
  return {
    id: '217',
    type: 'whatsapp_cloud',
    name: 'shahd Shereef',
    phoneNumber: null,
    status: 'CONNECTED',
    canSend: true,
    requiresRelink: false,
    isDefault: false,
    assignedUserId: null,
    assignedUserName: null,
    lastConnectedAt: null,
    lastSyncedAt: null,
    existsInProvider: true,
    chatsCount: 0,
    unreadChatsCount: 0,
    ...patch,
  };
}

/** Drop-in for `WhatsAppRealtimeService`: push hub events by hand. */
export class FakeRealtime {
  readonly state = signal<WaRealtimeState>('connected');
  readonly connected = signal(true);
  readonly message = new Subject<WaMessageEvent>();
  readonly status = new Subject<WaMessageStatusEvent>();
  readonly chat = new Subject<WaChat>();
  readonly instance = new Subject<WaInstanceStatusEvent>();
  readonly reconnected = new Subject<void>();

  readonly message$ = this.message.asObservable();
  readonly messageStatus$ = this.status.asObservable();
  readonly chatUpdated$ = this.chat.asObservable();
  readonly instanceStatus$ = this.instance.asObservable();
  readonly reconnected$ = this.reconnected.asObservable();
}
