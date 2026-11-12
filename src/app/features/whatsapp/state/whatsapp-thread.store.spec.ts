import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { WaMessage, WaSendTextRequest } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { WindowFocusService } from '../services/window-focus.service';
import { FakeRealtime, makeChat, makeMessage } from '../testing/whatsapp.testing';
import { RejectedDraft, WhatsAppThreadStore } from './whatsapp-thread.store';
import { WhatsAppSessionStore } from './whatsapp-session.store';

describe('WhatsAppThreadStore', () => {
  let store: WhatsAppThreadStore;
  let realtime: FakeRealtime;
  let history: WaMessage[];
  let sends: { req: WaSendTextRequest; reply: Subject<WaMessage> }[];

  const chat = makeChat({ id: 1, unreadCount: 0 });

  beforeEach(() => {
    realtime = new FakeRealtime();
    history = [makeMessage({ id: 10 }), makeMessage({ id: 11 })];
    sends = [];
    const api: Partial<WhatsAppApiService> = {
      chatMessages: () => of(history),
      markChatRead: () => of(null),
      sendText: (req: WaSendTextRequest) => {
        const reply = new Subject<WaMessage>();
        sends.push({ req, reply });
        return reply.asObservable();
      },
    };
    TestBed.configureTestingModule({
      providers: [
        WhatsAppThreadStore,
        { provide: WhatsAppApiService, useValue: api },
        { provide: WhatsAppRealtimeService, useValue: realtime },
        {
          provide: WhatsAppSessionStore,
          useValue: { isAdmin: signal(false), canSendFrom: () => true, noteChatRead: () => undefined },
        },
        { provide: WindowFocusService, useValue: { focused: signal(true) } },
        { provide: AuthService, useValue: { currentUser: signal({ userId: 'me', fullName: 'Me', email: 'me@x' }) } },
      ],
    });
    store = TestBed.inject(WhatsAppThreadStore);
    store.connect({ kind: 'chat', chatId: 1, chat });
  });

  const ids = () => store.messages().map((m) => m.id);

  it('loads the latest history', () => {
    expect(ids()).toEqual([10, 11]);
    expect(store.loading()).toBeFalse();
  });

  it('appends a hub message once — dedupe by message id', () => {
    const incoming = makeMessage({ id: 12, text: 'new' });
    realtime.message.next({ instanceId: '217', chat, message: incoming });
    realtime.message.next({ instanceId: '217', chat, message: incoming });
    expect(ids()).toEqual([10, 11, 12]);
  });

  it('ignores messages of other chats', () => {
    realtime.message.next({ instanceId: '217', chat: makeChat({ id: 2 }), message: makeMessage({ id: 99, chatId: 2 }) });
    expect(ids()).toEqual([10, 11]);
  });

  it('shows an optimistic bubble, then replaces it with the stored row (same clientMessageId)', () => {
    expect(store.send('hello')).toBeTrue();
    const pending = store.messages()[2];
    expect(pending.id).toBeLessThan(0);
    expect(pending.status).toBe('Pending');

    const { req, reply } = sends[0];
    expect(req.target).toEqual({ chatId: 1 });
    const stored = makeMessage({ id: 20, direction: 'Outgoing', status: 'Sent', clientMessageId: req.clientMessageId, text: 'hello' });
    // The hub echo may arrive before the HTTP response — still one bubble.
    realtime.message.next({ instanceId: '217', chat, message: stored });
    reply.next(stored);
    expect(ids()).toEqual([10, 11, 20]);
  });

  it('moves ticks forward only and keeps the failure reason', () => {
    store.send('x');
    const { req, reply } = sends[0];
    reply.next(makeMessage({ id: 21, direction: 'Outgoing', status: 'Sent', clientMessageId: req.clientMessageId }));

    const status = (s: WaMessage['status'], errorMessage: string | null = null) =>
      realtime.status.next({ instanceId: '217', chatId: 1, messageId: 21, externalMessageId: null, status: s, deliveredAt: null, readAt: null, errorMessage });

    status('Read');
    status('Delivered'); // late, out of order
    expect(store.messages().find((m) => m.id === 21)?.status).toBe('Read');

    store.send('y');
    const second = sends[1];
    second.reply.next(makeMessage({ id: 22, direction: 'Outgoing', status: 'Sent', clientMessageId: second.req.clientMessageId }));
    realtime.status.next({ instanceId: '217', chatId: 1, messageId: 22, externalMessageId: null, status: 'Failed', deliveredAt: null, readAt: null, errorMessage: 'Number not on WhatsApp' });
    const failed = store.messages().find((m) => m.id === 22);
    expect(failed?.status).toBe('Failed');
    expect(failed?.errorMessage).toBe('Number not on WhatsApp');
  });

  it('a 400 hands the draft back with the server message', () => {
    const rejected: RejectedDraft[] = [];
    store.rejected$.subscribe((d) => rejected.push(d));
    store.send('outside the window');
    const err: ApiError = { status: 400, message: 'The 24-hour window is closed' };
    sends[0].reply.error(err);

    expect(rejected.length).toBe(1);
    expect(rejected[0].text).toBe('outside the window');
    expect(rejected[0].reason).toBe('The 24-hour window is closed');

    store.discard(rejected[0].clientMessageId);
    expect(ids()).toEqual([10, 11]);
  });

  it('switches the composer when the hub reports the window closed', () => {
    expect(store.composer().mode).toBe('reply');
    realtime.chat.next({ ...chat, canReply: false, replyWindowEndsAt: null, canSendTemplate: true });
    expect(store.composer().mode).toBe('templateOnly');
    expect(store.send('nope')).toBeFalse();
    expect(sends.length).toBe(0);

    // The customer writes again → the window reopens.
    realtime.message.next({ instanceId: '217', chat: { ...chat, canReply: true }, message: makeMessage({ id: 30 }) });
    expect(store.composer().mode).toBe('reply');
  });
});
