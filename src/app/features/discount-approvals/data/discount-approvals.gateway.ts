import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheBypass,
  withInlineHandling,
  withCacheInvalidate,
  withSilentErrors,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models';
import {
  CreateDiscountApprovalInput,
  DEFAULT_DISCOUNT_THRESHOLD_PERCENT,
  DISCOUNT_APPROVAL_STATUSES,
  DiscountApproval,
  DiscountApprovalQuery,
  DiscountApprovalStatus,
  SalesRules,
} from '../models/discount-approvals.models';
import { discountPercent, round2 } from '../utils/discount.util';

/** `DiscountApprovals/*` + `Settings/sales-rules`. The server issues and enforces every code. */
export interface DiscountApprovalsGateway {
  list(query: DiscountApprovalQuery): Observable<PagedResult<DiscountApproval>>;
  get(id: number): Observable<DiscountApproval>;
  create(input: CreateDiscountApprovalInput): Observable<DiscountApproval>;
  approve(id: number): Observable<DiscountApproval>;
  reject(id: number, reason: string): Observable<DiscountApproval>;
  salesRules(): Observable<SalesRules>;
  /** Admin. */
  updateSalesRules(rules: SalesRules): Observable<SalesRules>;
}

/**
 * Machine-readable causes on a refused save / request (`data.reason`).
 * The UI shows the server's Arabic `message`; the reason only decides
 * where (under the code input vs. a toast).
 */
export const DISCOUNT_REASONS = {
  required: 'discount_approval_required',
  invalid: 'discount_approval_invalid',
  mismatch: 'discount_approval_mismatch',
  customerRequired: 'discount_customer_required',
  notNeeded: 'discount_approval_not_needed',
  invalidAmount: 'discount_invalid_amount',
  alreadyDecided: 'discount_approval_already_decided',
} as const;

/** Reasons that mean "the approval code is missing / wrong for this save". */
export const DISCOUNT_SAVE_REASONS: ReadonlySet<string> = new Set([
  DISCOUNT_REASONS.required,
  DISCOUNT_REASONS.invalid,
  DISCOUNT_REASONS.mismatch,
  DISCOUNT_REASONS.customerRequired,
]);

const EP = API_ENDPOINTS.discountApprovals;


// ═══════════════════════════ mapper ═══════════════════════════

type Dto = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function intOrNull(v: unknown): number | null {
  const n = num(v, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

/** Enums may arrive as name or ordinal. */
function parseStatus(raw: unknown): DiscountApprovalStatus {
  if (typeof raw === 'number' || /^\d+$/.test(String(raw ?? ''))) return DISCOUNT_APPROVAL_STATUSES[Number(raw)] ?? 'Pending';
  const text = String(raw ?? '').toLowerCase();
  return DISCOUNT_APPROVAL_STATUSES.find((s) => s.toLowerCase() === text) ?? 'Pending';
}

export function toDiscountApproval(dto: Dto): DiscountApproval {
  const amount = num(dto['amount']);
  const discount = num(dto['discount']);
  const rawType = dto['type'];
  return {
    id: num(dto['id']),
    type: rawType === 'PaymentRequest' || rawType === 1 || rawType === '1' ? 'PaymentRequest' : 'PriceQuotation',
    customerId: intOrNull(dto['customerId']),
    customerName: str(dto['customerName']) ?? '—',
    amount,
    discount,
    netAmount: dto['netAmount'] == null ? round2(amount - discount) : num(dto['netAmount']),
    percent: dto['percent'] == null ? discountPercent(amount, discount) : num(dto['percent']),
    status: parseStatus(dto['status']),
    requestedById: str(dto['requestedById']) ?? '',
    requestedByName: str(dto['requestedByName']) ?? '—',
    requestedAt: str(dto['requestedAt']) ?? '',
    decidedById: str(dto['decidedById']),
    decidedByName: str(dto['decidedByName']),
    decidedAt: str(dto['decidedAt']),
    code: str(dto['code']),
    validUntil: str(dto['validUntil']),
    rejectReason: str(dto['rejectReason']),
    referenceId: intOrNull(dto['referenceId']),
  };
}

function toSalesRules(d: Dto | null | undefined): SalesRules {
  return {
    discountApprovalThresholdPercent: num(d?.['discountApprovalThresholdPercent'], DEFAULT_DISCOUNT_THRESHOLD_PERCENT),
    awaitingReplyThresholdMinutes: num(d?.['awaitingReplyThresholdMinutes'], 60),
  };
}

// ═══════════════════════════ HTTP ═══════════════════════════

@Injectable({ providedIn: 'root' })
export class HttpDiscountApprovalsGateway implements DiscountApprovalsGateway {
  private readonly api = inject(ApiService);

  list(query: DiscountApprovalQuery): Observable<PagedResult<DiscountApproval>> {
    const params: Record<string, string | number> = { pageIndex: query.pageIndex ?? 1, pageSize: query.pageSize ?? 20 };
    if (query.status) params['status'] = query.status;
    return this.api
      .get<PagedResult<Dto>>(EP.list, { params, context: withSkipLoader(withCacheBypass()) })
      .pipe(map((p) => ({ ...p, data: (p?.data ?? []).map(toDiscountApproval) })));
  }

  get(id: number): Observable<DiscountApproval> {
    return this.api
      .get<Dto>(EP.byId(id), { context: withSkipLoader(withCacheBypass(withInlineHandling())) })
      .pipe(map(toDiscountApproval));
  }

  create(input: CreateDiscountApprovalInput): Observable<DiscountApproval> {
    return this.api.post<Dto>(EP.list, input, { context: withInlineHandling() }).pipe(map(toDiscountApproval));
  }

  approve(id: number): Observable<DiscountApproval> {
    return this.api.post<Dto>(EP.approve(id), {}, { context: withInlineHandling() }).pipe(map(toDiscountApproval));
  }

  reject(id: number, reason: string): Observable<DiscountApproval> {
    return this.api.post<Dto>(EP.reject(id), { reason }, { context: withInlineHandling() }).pipe(map(toDiscountApproval));
  }

  salesRules(): Observable<SalesRules> {
    return this.api
      .get<Dto>(EP.salesRules, { context: withSilentErrors(withSkipLoader(withCache({ ttlMs: CACHE_TTL.LONG }))) })
      .pipe(map(toSalesRules));
  }

  updateSalesRules(rules: SalesRules): Observable<SalesRules> {
    return this.api
      .put<Dto>(EP.salesRules, rules, { context: withInlineHandling(withCacheInvalidate(['Settings/sales-rules'])) })
      .pipe(map((d) => toSalesRules(d ?? (rules as unknown as Dto))));
  }
}

export const DISCOUNT_APPROVALS_GATEWAY = new InjectionToken<DiscountApprovalsGateway>('DISCOUNT_APPROVALS_GATEWAY', {
  providedIn: 'root',
  factory: () => inject(HttpDiscountApprovalsGateway),
});

/**
 * What the quotation / payment-link forms and the approvals page share: the
 * gateway and the sales rules (threshold), loaded once and updated in place
 * when an Admin edits them.
 */
@Injectable({ providedIn: 'root' })
export class DiscountApprovalsService {
  readonly gateway = inject(DISCOUNT_APPROVALS_GATEWAY);

  private readonly rulesState = signal<SalesRules>({
    discountApprovalThresholdPercent: DEFAULT_DISCOUNT_THRESHOLD_PERCENT,
    awaitingReplyThresholdMinutes: 60,
  });
  readonly rules = this.rulesState.asReadonly();
  /** Discount % above which a non-Admin needs a code (the server decides for real). */
  readonly threshold = computed(() => {
    const t = this.rulesState().discountApprovalThresholdPercent;
    return t >= 0 ? t : DEFAULT_DISCOUNT_THRESHOLD_PERCENT;
  });
  readonly threshold$ = toObservable(this.threshold);

  constructor() {
    this.gateway.salesRules().subscribe({ next: (r) => this.rulesState.set(r), error: () => undefined });
  }

  saveRules(rules: SalesRules): Observable<SalesRules> {
    return this.gateway.updateSalesRules(rules).pipe(tap((r) => this.rulesState.set(r)));
  }
}
