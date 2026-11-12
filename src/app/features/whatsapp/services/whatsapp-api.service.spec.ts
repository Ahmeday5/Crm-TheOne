import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { WaUploadEvent } from '../models/whatsapp.models';
import { makeMessage } from '../testing/whatsapp.testing';
import { WhatsAppApiService } from './whatsapp-api.service';

const BASE = environment.apiUrl.replace(/\/+$/, '');
const url = (path: string) => `${BASE}/WhatsApp/${path}`;

describe('WhatsAppApiService', () => {
  let api: WhatsAppApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WhatsAppApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /chats sends the query and unwraps the page', () => {
    let count = -1;
    api.chats({ pageIndex: 2, pageSize: 20, search: 'ahmed', instanceId: '217', unreadOnly: true }).subscribe((p) => {
      count = p.count;
      expect(p.data.length).toBe(1);
    });

    const req = http.expectOne((r) => r.url === url('chats'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('pageIndex')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('search')).toBe('ahmed');
    expect(req.request.params.get('instanceId')).toBe('217');
    expect(req.request.params.get('unreadOnly')).toBe('true');
    req.flush({ statusCode: 200, message: 'ok', data: { pageIndex: 2, pageSize: 20, count: 21, data: [{ id: 1 }] } });
    expect(count).toBe(21);
  });

  it('GET /chats omits unreadOnly=false and empty filters', () => {
    api.chats({ pageIndex: 1, pageSize: 30 }).subscribe();
    const req = http.expectOne((r) => r.url === url('chats'));
    expect(req.request.params.has('unreadOnly')).toBeFalse();
    expect(req.request.params.has('instanceId')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({ statusCode: 200, message: 'ok', data: null });
  });

  it('GET /chats/{id}/messages pages with beforeId', () => {
    api.chatMessages(7, { take: 50, beforeId: 340 }).subscribe((rows) => expect(rows.length).toBe(0));
    const req = http.expectOne((r) => r.url === url('chats/7/messages'));
    expect(req.request.params.get('take')).toBe('50');
    expect(req.request.params.get('beforeId')).toBe('340');
    req.flush({ statusCode: 200, message: 'ok', data: [] });
  });

  it('POST /chats/{id}/read', () => {
    api.markChatRead(7).subscribe();
    const req = http.expectOne(url('chats/7/read'));
    expect(req.request.method).toBe('POST');
    req.flush({ statusCode: 200, message: 'ok', data: null });
  });

  it('GET /customers/{id}/messages', () => {
    api.customerMessages(42, 50).subscribe();
    const req = http.expectOne((r) => r.url === url('customers/42/messages'));
    expect(req.request.params.get('take')).toBe('50');
    req.flush({ statusCode: 200, message: 'ok', data: [] });
  });

  it('POST /send with the target, clientMessageId and text (no instanceId for employees)', () => {
    let id = 0;
    api.sendText({ target: { chatId: 7 }, text: 'hello', clientMessageId: 'c-1' }).subscribe((m) => (id = m.id));
    const req = http.expectOne(url('send'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ chatId: 7, instanceId: undefined, clientMessageId: 'c-1', text: 'hello' });
    req.flush({ statusCode: 200, message: 'ok', data: makeMessage({ id: 9 }) });
    expect(id).toBe(9);
  });

  it('POST /send-media builds multipart FormData without a manual Content-Type and reports progress', () => {
    const file = new File(['x'.repeat(10)], 'photo.jpg', { type: 'image/jpeg' });
    const events: WaUploadEvent[] = [];
    api.sendMedia({ chatId: 7, file, caption: ' look ', clientMessageId: 'c-2' }).subscribe((e) => events.push(e));

    const req = http.expectOne(url('send-media'));
    const form = req.request.body as FormData;
    expect(form instanceof FormData).toBeTrue();
    expect((form.get('file') as File).name).toBe('photo.jpg');
    expect(form.get('chatId')).toBe('7');
    expect(form.get('clientMessageId')).toBe('c-2');
    expect(form.get('caption')).toBe('look');
    expect(req.request.headers.has('Content-Type')).toBeFalse();
    expect(req.request.reportProgress).toBeTrue();

    req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    req.flush({ statusCode: 200, message: 'ok', data: makeMessage({ id: 11, direction: 'Outgoing' }) });

    expect(events[0]).toEqual({ kind: 'progress', percent: 50 });
    const done = events[events.length - 1];
    expect(done.kind).toBe('done');
    expect(done.kind === 'done' && done.message.id).toBe(11);
  });

  it('GET /templates passes instanceId only when given', () => {
    api.templates('217').subscribe();
    const withId = http.expectOne((r) => r.url === url('templates'));
    expect(withId.request.params.get('instanceId')).toBe('217');
    withId.flush({ statusCode: 200, message: 'ok', data: [] });

    api.templates(null).subscribe();
    const withoutId = http.expectOne((r) => r.url === url('templates'));
    expect(withoutId.request.params.has('instanceId')).toBeFalse();
    withoutId.flush({ statusCode: 200, message: 'ok', data: [] });
  });

  it('POST /send-template sends the template and parameters keyed by name', () => {
    api
      .sendTemplate({
        target: { phone: '+201012345678' },
        clientMessageId: 'c-3',
        templateId: 5,
        template: 'welcome',
        language: 'ar',
        parameters: { name: 'Ahmed' },
      })
      .subscribe();
    const req = http.expectOne(url('send-template'));
    expect(req.request.body).toEqual({
      phone: '+201012345678',
      instanceId: undefined,
      clientMessageId: 'c-3',
      templateId: 5,
      template: 'welcome',
      language: 'ar',
      parameters: { name: 'Ahmed' },
    });
    req.flush({ statusCode: 200, message: 'ok', data: makeMessage() });
  });

  it('PUT /users/{id}/number with { instanceId: null } unassigns', () => {
    api.assignNumber('u 1', { instanceId: null }).subscribe((r) => expect(r).toBeNull());
    const req = http.expectOne(url('users/u%201/number'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ instanceId: null });
    req.flush({ statusCode: 200, message: 'ok', data: null });
  });

  it('POST /import?max= and GET /diagnostics, /status, /instances', () => {
    api.importHistory(100).subscribe((r) => expect(r.newChats).toBe(3));
    const imp = http.expectOne((r) => r.url === url('import'));
    expect(imp.request.method).toBe('POST');
    expect(imp.request.params.get('max')).toBe('100');
    imp.flush({ statusCode: 200, message: 'ok', data: { conversations: 5, newChats: 3, newMessages: 40, skipped: 2, errors: [] } });

    api.diagnostics().subscribe();
    http.expectOne(url('diagnostics')).flush({ statusCode: 200, message: 'ok', data: {} });
    api.status().subscribe();
    http.expectOne(url('status')).flush({ statusCode: 200, message: 'ok', data: {} });
    api.instances().subscribe((list) => expect(list).toEqual([]));
    http.expectOne(url('instances')).flush({ statusCode: 200, message: 'ok', data: null });
  });
});
