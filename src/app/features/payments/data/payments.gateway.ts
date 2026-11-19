import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import {
  withCacheBypass,
  withInlineHandling,
  withSkipAuth,
  withSilentErrors,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { MockStore, daysFromNow, fail, mockReply, nowIso, page, randomToken } from '../../../core/mocks/mock-http.util';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PagedResult } from '../../../shared/models';
import {
  CreatePaymentRequestInput,
  PaymentMethod,
  PaymentMethodInput,
  PaymentRequest,
  PaymentRequestQuery,
  PublicPayment,
  PublicPaymentConfirmInput,
  isWallet,
} from '../models/payments.models';
import { toPaymentMethod, toPaymentRequest, toPublicPayment } from './payments.mapper';

/** Staff side — methods (Admin writes) + requests. */
export interface PaymentsGateway {
  methods(includeInactive?: boolean): Observable<PaymentMethod[]>;
  createMethod(input: PaymentMethodInput): Observable<PaymentMethod>;
  updateMethod(id: number, input: PaymentMethodInput): Observable<PaymentMethod>;
  deleteMethod(id: number): Observable<unknown>;

  requests(query: PaymentRequestQuery): Observable<PagedResult<PaymentRequest>>;
  request(id: number): Observable<PaymentRequest>;
  /** Requests the customer marked as paid, not yet confirmed by staff (badge — never toasts). */
  awaitingReviewCount(): Observable<number>;
  createRequest(input: CreatePaymentRequestInput): Observable<PaymentRequest>;
  markPaid(id: number, note: string | null): Observable<PaymentRequest>;
  cancel(id: number): Observable<PaymentRequest>;
}

/** Anonymous side — the `/pay/:token` page. */
export interface PublicPaymentsGateway {
  get(token: string): Observable<PublicPayment>;
  confirm(token: string, input: PublicPaymentConfirmInput): Observable<PublicPayment>;
}

/** What the payment panel pre-fills from the customer record. */
export interface CustomerContact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Picks the live adapter, or the mock while `CONTRACT_MOCKS.payments` is on. */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly api = inject(ApiService);
  private readonly http = new HttpPaymentsGateway(this.api);
  private readonly mock = inject(MockPaymentsGateway);

  get gateway(): PaymentsGateway & PublicPaymentsGateway {
    return isMocked('payments') ? this.mock : this.http;
  }

  /**
   * Phone / email of the chat's linked customer (`Customers/{id}/getCustomerById`)
   * — a convenience pre-fill, so it never toasts: callers fall back to the chat.
   */
  customerContact(customerId: number): Observable<CustomerContact> {
    return this.api
      .get<Record<string, unknown>>(API_ENDPOINTS.customers.byId(customerId), {
        context: withSilentErrors(withSkipLoader()),
      })
      .pipe(
        map((c) => ({
          name: text(c?.['name']) ?? text(c?.['fullName']),
          phone: text(c?.['phone']) ?? text(c?.['phoneNumber']),
          email: text(c?.['email']),
        })),
      );
  }
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ═══════════════════════════ HTTP ═══════════════════════════

const EP = API_ENDPOINTS.payments;

/** Raw JSON before the mapper — the live Swagger documents no response schemas. */
type Dto = Record<string, unknown>;

/**
 * Live adapter. Every response goes through `payments.mapper.ts`; query and
 * multipart names follow the live Swagger casing (`PageIndex`, `PayerPhone`).
 */
class HttpPaymentsGateway implements PaymentsGateway, PublicPaymentsGateway {
  constructor(private readonly api: ApiService) {}

  methods(includeInactive = false): Observable<PaymentMethod[]> {
    return this.api
      .get<Dto[]>(EP.methods, {
        params: includeInactive ? { includeInactive: true } : {},
        context: withSkipLoader(withCacheBypass()),
      })
      .pipe(map((list) => (list ?? []).map(toPaymentMethod)));
  }

  createMethod(input: PaymentMethodInput): Observable<PaymentMethod> {
    return this.api.post<Dto>(EP.methods, input, { context: withInlineHandling() }).pipe(map(toPaymentMethod));
  }

  updateMethod(id: number, input: PaymentMethodInput): Observable<PaymentMethod> {
    return this.api.put<Dto>(EP.method(id), input, { context: withInlineHandling() }).pipe(map(toPaymentMethod));
  }

  deleteMethod(id: number): Observable<unknown> {
    return this.api.delete(EP.method(id), { context: withInlineHandling() });
  }

  requests(query: PaymentRequestQuery): Observable<PagedResult<PaymentRequest>> {
    return this.page(query, withSkipLoader(withCacheBypass())).pipe(
      map((page) => ({ ...page, data: (page?.data ?? []).map(toPaymentRequest) })),
    );
  }

  request(id: number): Observable<PaymentRequest> {
    return this.api.get<Dto>(EP.request(id), { context: withSkipLoader(withCacheBypass()) }).pipe(map(toPaymentRequest));
  }

  awaitingReviewCount(): Observable<number> {
    return this.page(
      { status: 'CustomerConfirmed', pageIndex: 1, pageSize: 1 },
      withSilentErrors(withSkipLoader(withCacheBypass())),
    ).pipe(map((page) => page?.count ?? 0));
  }

  createRequest(input: CreatePaymentRequestInput): Observable<PaymentRequest> {
    return this.api.post<Dto>(EP.requests, input, { context: withInlineHandling() }).pipe(map(toPaymentRequest));
  }

  markPaid(id: number, note: string | null): Observable<PaymentRequest> {
    return this.api.post<Dto>(EP.markPaid(id), { note }, { context: withInlineHandling() }).pipe(map(toPaymentRequest));
  }

  cancel(id: number): Observable<PaymentRequest> {
    return this.api.post<Dto>(EP.cancel(id), {}, { context: withInlineHandling() }).pipe(map(toPaymentRequest));
  }

  get(token: string): Observable<PublicPayment> {
    return this.api
      .get<Dto>(EP.publicPayment(token), { context: withSkipAuth(withInlineHandling(withCacheBypass())) })
      .pipe(map(toPublicPayment));
  }

  confirm(token: string, input: PublicPaymentConfirmInput): Observable<PublicPayment> {
    const form = new FormData();
    if (input.payerPhone?.trim()) form.append('PayerPhone', input.payerPhone.trim());
    if (input.payerReference?.trim()) form.append('PayerReference', input.payerReference.trim());
    if (input.receipt) form.append('receipt', input.receipt, input.receipt.name);
    return this.api
      .post<Dto>(EP.publicConfirm(token), form, { context: withSkipAuth(withInlineHandling()) })
      .pipe(map(toPublicPayment));
  }

  private page(query: PaymentRequestQuery, context: HttpContext): Observable<PagedResult<Dto>> {
    const params: Record<string, string | number> = { PageIndex: query.pageIndex ?? 1, PageSize: query.pageSize ?? 20 };
    if (query.status) params['Status'] = query.status;
    if (query.search?.trim()) params['Search'] = query.search.trim();
    if (query.chatId) params['ChatId'] = query.chatId;
    return this.api.get<PagedResult<Dto>>(EP.requests, { params, context });
  }
}

// ═══════════════════════════ Mock ═══════════════════════════

interface PaymentsDb {
  methods: PaymentMethod[];
  requests: PaymentRequest[];
  nextId: number;
}

const MERCHANT = 'The One System';

function seed(): PaymentsDb {
  const at = nowIso();
  const base = { instructions: null, currency: 'EGP' as const, isActive: true, createdAt: at, updatedAt: null };
  return {
    nextId: 4,
    requests: [],
    methods: [
      { ...base, id: 1, type: 'InstaPay', accountName: 'The One System', phoneNumber: '01000000001', instapayAddress: 'theone@instapay', instapayLink: null, sortOrder: 0 },
      { ...base, id: 2, type: 'VodafoneCash', accountName: 'The One System', phoneNumber: '01000000002', instapayAddress: null, instapayLink: null, sortOrder: 1 },
      { ...base, id: 3, type: 'EtisalatCash', accountName: 'The One System', phoneNumber: '01100000003', instapayAddress: null, instapayLink: null, sortOrder: 2 },
    ],
  };
}

/** Same rules the backend enforces (`docs/api/payments.md` § Validation). */
function validateMethod(input: PaymentMethodInput): void {
  if (!input.accountName?.trim()) fail(400, 'VALIDATION', 'اسم صاحب الحساب مطلوب');
  if (isWallet(input.type) && !/^01[0125]\d{8}$/.test(input.phoneNumber ?? '')) fail(400, 'INVALID_PHONE', 'رقم المحفظة غير صحيح');
  if (input.type === 'InstaPay' && !input.instapayAddress?.trim() && !input.instapayLink?.trim()) {
    fail(400, 'INSTAPAY_TARGET_REQUIRED', 'أدخل عنوان InstaPay أو رابط الدفع');
  }
}

@Injectable({ providedIn: 'root' })
export class MockPaymentsGateway implements PaymentsGateway, PublicPaymentsGateway {
  private readonly auth = inject(AuthService);
  private readonly db = new MockStore<PaymentsDb>('crm_mock_payments_v1', seed);

  methods(includeInactive = false): Observable<PaymentMethod[]> {
    return mockReply(() =>
      this.db
        .get()
        .methods.filter((m) => includeInactive || m.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    );
  }

  createMethod(input: PaymentMethodInput): Observable<PaymentMethod> {
    return mockReply(() => {
      validateMethod(input);
      const m: PaymentMethod = { ...input, id: this.bump(), currency: 'EGP', createdAt: nowIso(), updatedAt: null };
      this.db.update((d) => d.methods.push(m));
      return m;
    });
  }

  updateMethod(id: number, input: PaymentMethodInput): Observable<PaymentMethod> {
    return mockReply(() => {
      validateMethod(input);
      const m = this.findMethod(id);
      this.db.update(() => Object.assign(m, input, { updatedAt: nowIso() }));
      return m;
    });
  }

  deleteMethod(id: number): Observable<unknown> {
    return mockReply(() => {
      this.findMethod(id);
      this.db.update((d) => (d.methods = d.methods.filter((m) => m.id !== id)));
      return null;
    });
  }

  requests(query: PaymentRequestQuery): Observable<PagedResult<PaymentRequest>> {
    return mockReply(() => {
      this.expireDue();
      const q = query.search?.trim().toLowerCase();
      const list = this.db
        .get()
        .requests.filter((r) => !query.status || r.status === query.status)
        .filter((r) => !query.chatId || r.chatId === query.chatId)
        .filter(
          (r) =>
            !q ||
            [r.customerName, r.customerPhone, r.customerEmail, r.description, r.payerReference]
              .some((v) => v?.toLowerCase().includes(q)),
        )
        .sort((a, b) => b.id - a.id);
      return page(list, query.pageIndex ?? 1, query.pageSize ?? 20) as PagedResult<PaymentRequest>;
    });
  }

  request(id: number): Observable<PaymentRequest> {
    return mockReply(() => {
      this.expireDue();
      return this.findRequest(id);
    });
  }

  awaitingReviewCount(): Observable<number> {
    return mockReply(() => {
      this.expireDue();
      return this.db.get().requests.filter((r) => r.status === 'CustomerConfirmed').length;
    });
  }

  createRequest(input: CreatePaymentRequestInput): Observable<PaymentRequest> {
    return mockReply(() => {
      const m = this.db.get().methods.find((x) => x.id === input.methodId && x.isActive);
      if (!m) fail(400, 'METHOD_INACTIVE', 'طريقة الدفع غير متاحة');
      if (!(input.amount > 0) || input.amount > 1_000_000) fail(400, 'INVALID_AMOUNT', 'المبلغ غير صحيح');
      if (!input.customerPhone?.trim() && !input.customerEmail?.trim()) fail(400, 'CONTACT_REQUIRED', 'الهاتف أو البريد مطلوب');
      const user = this.auth.currentUser();
      const r: PaymentRequest = {
        id: this.bump(),
        token: randomToken(24),
        amount: Math.round(input.amount * 100) / 100,
        currency: 'EGP',
        description: input.description,
        status: 'Pending',
        expiresAt: daysFromNow(input.validityDays),
        method: {
          methodId: m.id, type: m.type, accountName: m.accountName, phoneNumber: m.phoneNumber,
          instapayAddress: m.instapayAddress, instapayLink: m.instapayLink, instructions: m.instructions,
        },
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        chatId: input.chatId,
        customerId: input.customerId,
        createdById: user?.userId ?? 'me',
        createdByName: user?.fullName ?? 'أنت',
        createdAt: nowIso(),
        payerPhone: null, payerReference: null, receiptUrl: null, customerConfirmedAt: null,
        paidAt: null, paidByName: null, staffNote: null, cancelledAt: null, viewCount: 0, lastViewedAt: null,
      };
      this.db.update((d) => d.requests.push(r));
      return r;
    });
  }

  markPaid(id: number, note: string | null): Observable<PaymentRequest> {
    return mockReply(() => {
      const r = this.findRequest(id);
      if (r.status === 'Paid' || r.status === 'Cancelled') fail(409, 'INVALID_STATE', 'لا يمكن تعديل هذا الطلب');
      this.db.update(() =>
        Object.assign(r, { status: 'Paid', paidAt: nowIso(), paidByName: this.auth.currentUser()?.fullName ?? 'أنت', staffNote: note }),
      );
      return r;
    });
  }

  cancel(id: number): Observable<PaymentRequest> {
    return mockReply(() => {
      const r = this.findRequest(id);
      if (r.status === 'Paid') fail(409, 'INVALID_STATE', 'الطلب مدفوع بالفعل');
      this.db.update(() => Object.assign(r, { status: 'Cancelled', cancelledAt: nowIso() }));
      return r;
    });
  }

  get(token: string): Observable<PublicPayment> {
    return mockReply(() => {
      this.expireDue();
      const r = this.byToken(token);
      this.db.update(() => Object.assign(r, { viewCount: r.viewCount + 1, lastViewedAt: nowIso() }));
      return toPublic(r);
    });
  }

  confirm(token: string, input: PublicPaymentConfirmInput): Observable<PublicPayment> {
    return mockReply(() => {
      this.expireDue();
      const r = this.byToken(token);
      if (r.status !== 'Pending') fail(409, 'INVALID_STATE', 'لا يمكن تأكيد هذا الطلب');
      if (!input.receipt) fail(400, 'INVALID_FILE', 'لازم ترفق صورة الإيصال');
      this.db.update(() =>
        Object.assign(r, {
          status: 'CustomerConfirmed',
          customerConfirmedAt: nowIso(),
          payerPhone: input.payerPhone?.trim() || null,
          payerReference: input.payerReference?.trim() || null,
          receiptUrl: null,
        }),
      );
      return toPublic(r);
    });
  }

  // ─────────── helpers ───────────

  private expireDue(): void {
    const now = Date.now();
    const due = this.db.get().requests.filter((r) => r.status === 'Pending' && Date.parse(r.expiresAt) < now);
    if (due.length) this.db.update(() => due.forEach((r) => (r.status = 'Expired')));
  }

  private byToken(token: string): PaymentRequest {
    return this.db.get().requests.find((r) => r.token === token) ?? fail(404, 'NOT_FOUND', 'الرابط غير صحيح');
  }

  private findMethod(id: number): PaymentMethod {
    return this.db.get().methods.find((m) => m.id === id) ?? fail(404, 'NOT_FOUND', 'طريقة الدفع غير موجودة');
  }

  private findRequest(id: number): PaymentRequest {
    return this.db.get().requests.find((r) => r.id === id) ?? fail(404, 'NOT_FOUND', 'الطلب غير موجود');
  }

  private bump(): number {
    let id = 0;
    this.db.update((d) => (id = d.nextId++));
    return id;
  }
}

function toPublic(r: PaymentRequest): PublicPayment {
  return {
    amount: r.amount,
    currency: r.currency,
    description: r.description,
    status: r.status,
    expiresAt: r.expiresAt,
    method: r.method,
    merchantName: MERCHANT,
    customerName: r.customerName,
    customerConfirmedAt: r.customerConfirmedAt,
    paidAt: r.paidAt,
  };
}
