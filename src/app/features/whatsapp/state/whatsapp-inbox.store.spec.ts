import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Pagination, WaChat, WaChatsQuery } from '../models/whatsapp.models';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../services/whatsapp-realtime.service';
import { FakeRealtime, makeChat, makeMessage } from '../testing/whatsapp.testing';
import { WhatsAppInboxStore } from './whatsapp-inbox.store';
import { WhatsAppSessionStore } from './whatsapp-session.store';

describe('WhatsAppInboxStore (live merge of hub events)', () => {
  let store: WhatsAppInboxStore;
  let realtime: FakeRealtime;
  let queries: WaChatsQuery[];
  let page: WaChat[];

  const older = makeChat({ id: 1, lastMessageAt: '2026-11-12T08:00:00Z', unreadCount: 0 });
  const newer = makeChat({ id: 2, lastMessageAt: '2026-11-12T09:00:00Z', unreadCount: 0 });

  beforeEach(() => {
    realtime = new FakeRealtime();
    queries = [];
    page = [newer, older];
    const api: Partial<WhatsAppApiService> = {
      chats: (q: WaChatsQuery) => {
        queries.push(q);
        const result: Pagination<WaChat> = { pageIndex: q.pageIndex, pageSize: q.pageSize, count: page.length, data: page };
        return of(result);
      },
    };
    TestBed.configureTestingModule({
      providers: [
        WhatsAppInboxStore,
        { provide: WhatsAppApiService, useValue: api },
        { provide: WhatsAppRealtimeService, useValue: realtime },
        { provide: WhatsAppSessionStore, useValue: { isAdmin: signal(true), noteChats: () => undefined } },
      ],
    });
    store = TestBed.inject(WhatsAppInboxStore);
    store.start();
    TestBed.flushEffects();
  });

  const ids = () => store.chats().map((c) => c.id);

  it('loads the first page newest first', () => {
    expect(ids()).toEqual([2, 1]);
    expect(store.loading()).toBeFalse();
  });

  it('a new message moves its chat to the top and updates preview + unread', () => {
    realtime.message.next({
      instanceId: '217',
      chat: { ...older, lastMessageAt: '2026-11-12T11:00:00Z', lastMessagePreview: 'new!', unreadCount: 3 },
      message: makeMessage({ id: 500, chatId: 1 }),
    });
    expect(ids()).toEqual([1, 2]);
    const top = store.chats()[0];
    expect(top.lastMessagePreview).toBe('new!');
    expect(top.unreadCount).toBe(3);
  });

  it('a message for an unknown chat is inserted at the top and counted', () => {
    const fresh = makeChat({ id: 9, lastMessageAt: '2026-11-12T12:00:00Z', unreadCount: 1 });
    realtime.message.next({ instanceId: '217', chat: fresh, message: makeMessage({ chatId: 9 }) });
    expect(ids()).toEqual([9, 2, 1]);
    expect(store.hasMore()).toBeFalse();
  });

  it('the same event twice never duplicates the chat', () => {
    const event = { instanceId: '217', chat: { ...older, lastMessageAt: '2026-11-12T11:00:00Z' }, message: makeMessage() };
    realtime.message.next(event);
    realtime.message.next(event);
    expect(ids()).toEqual([1, 2]);
  });

  it('the open chat always shows as read', () => {
    store.setActive(1);
    realtime.message.next({
      instanceId: '217',
      chat: { ...older, lastMessageAt: '2026-11-12T11:00:00Z', unreadCount: 4 },
      message: makeMessage(),
    });
    expect(store.chats().find((c) => c.id === 1)?.unreadCount).toBe(0);
    expect(store.chats().find((c) => c.id === 2)?.unreadCount).toBe(0);
  });

  it('chatUpdated patches the row without reordering (e.g. read in another tab)', () => {
    realtime.chat.next({ ...older, unreadCount: 0, canReply: false });
    expect(ids()).toEqual([2, 1]);
    expect(store.chats()[1].canReply).toBeFalse();
  });

  it('admin channel filter: queries by instanceId and ignores other channels live', () => {
    page = [newer];
    store.setChannel('217');
    TestBed.flushEffects();
    expect(queries[queries.length - 1].instanceId).toBe('217');

    const otherChannel = makeChat({ id: 30, instanceId: '999', lastMessageAt: '2026-11-12T12:00:00Z' });
    realtime.message.next({ instanceId: '999', chat: otherChannel, message: makeMessage({ chatId: 30 }) });
    expect(ids()).toEqual([2]);
  });

  it('the unread filter only admits chats that have unread messages', () => {
    page = [];
    store.setFilter('unread');
    TestBed.flushEffects();
    expect(queries[queries.length - 1].unreadOnly).toBeTrue();

    realtime.message.next({ instanceId: '217', chat: makeChat({ id: 40, unreadCount: 0 }), message: makeMessage() });
    expect(ids()).toEqual([]);
    realtime.message.next({ instanceId: '217', chat: makeChat({ id: 41, unreadCount: 1 }), message: makeMessage() });
    expect(ids()).toEqual([41]);
  });
});
