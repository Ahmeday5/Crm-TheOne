import {
  PAYMENT_METHOD_TYPES,
  PAYMENT_REQUEST_STATUSES,
  PaymentMethod,
  PaymentMethodSnapshot,
  PaymentMethodType,
  PaymentRequest,
  PaymentRequestStatus,
  PublicPayment,
} from '../models/payments.models';

/**
 * API → model boundary for payment links.
 *
 * The live Swagger documents both enums with Arabic display labels
 * (`"فودافون كاش"`, `"في انتظار الدفع"`) and no response schemas, while the
 * agreed contract says enum *names*. Every enum is therefore accepted as
 * name, ordinal or Arabic label and normalised here — screens only ever see
 * the canonical names. Requests still SEND names (the contract).
 */

/** Arabic labels exactly as Swagger lists them — same order as the enums. */
const METHOD_TYPE_LABELS: Record<string, PaymentMethodType> = {
  'إنستا باي': 'InstaPay',
  'انستاباي': 'InstaPay',
  'فودافون كاش': 'VodafoneCash',
  'اتصالات كاش': 'EtisalatCash',
  'أورنج كاش': 'OrangeCash',
  'اورنج كاش': 'OrangeCash',
  'وي باي': 'WePay',
};

const STATUS_LABELS: Record<string, PaymentRequestStatus> = {
  'في انتظار الدفع': 'Pending',
  'العميل أكّد التحويل': 'CustomerConfirmed',
  'العميل أكد التحويل': 'CustomerConfirmed',
  'تم الدفع': 'Paid',
  'ملغي': 'Cancelled',
  'منتهي الصلاحية': 'Expired',
};

function parseEnum<T extends string>(raw: unknown, values: readonly T[], labels: Record<string, T>, fallback: T): T {
  if (typeof raw === 'number' || /^\d+$/.test(String(raw ?? '').trim())) return values[Number(raw)] ?? fallback;
  const text = String(raw ?? '').trim();
  const byName = values.find((v) => v.toLowerCase() === text.toLowerCase());
  return byName ?? labels[text] ?? fallback;
}

export function parseMethodType(raw: unknown): PaymentMethodType {
  return parseEnum(raw, PAYMENT_METHOD_TYPES, METHOD_TYPE_LABELS, 'InstaPay');
}

export function parseRequestStatus(raw: unknown): PaymentRequestStatus {
  return parseEnum(raw, PAYMENT_REQUEST_STATUSES, STATUS_LABELS, 'Pending');
}

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

export function toPaymentMethod(dto: Dto): PaymentMethod {
  return {
    id: num(dto['id']),
    type: parseMethodType(dto['type']),
    accountName: str(dto['accountName']) ?? '',
    phoneNumber: str(dto['phoneNumber']),
    instapayAddress: str(dto['instapayAddress']),
    instapayLink: str(dto['instapayLink']),
    instructions: str(dto['instructions']),
    currency: 'EGP',
    isActive: dto['isActive'] !== false,
    sortOrder: num(dto['sortOrder']),
    createdAt: str(dto['createdAt']) ?? '',
    updatedAt: str(dto['updatedAt']),
  };
}

/** Nested `method: {…}` (contract) or the flat `methodType`, `methodAccountName`… columns. */
function toSnapshot(dto: Dto): PaymentMethodSnapshot {
  const nested = (dto['method'] ?? null) as Dto | null;
  const pick = (key: string): unknown =>
    nested ? nested[key] : dto[`method${key.charAt(0).toUpperCase()}${key.slice(1)}`];
  return {
    methodId: intOrNull(nested ? nested['methodId'] : dto['methodId']),
    type: parseMethodType(pick('type')),
    accountName: str(pick('accountName')) ?? '',
    phoneNumber: str(pick('phoneNumber')),
    instapayAddress: str(pick('instapayAddress')),
    instapayLink: str(pick('instapayLink')),
    instructions: str(pick('instructions')),
  };
}

/**
 * §9.4: `amount` is the net; `originalAmount` + `discount` are new. Older
 * builds send neither (no discount); a build sending only `discount`
 * still yields the original.
 */
function amounts(dto: Dto): { amount: number; originalAmount: number; discount: number } {
  const amount = num(dto['amount']);
  const discount = Math.max(0, num(dto['discount']));
  const original = dto['originalAmount'] == null ? amount + discount : num(dto['originalAmount'], amount);
  return { amount, originalAmount: Math.max(original, amount), discount };
}

export function toPaymentRequest(dto: Dto): PaymentRequest {
  return {
    id: num(dto['id']),
    token: str(dto['token']) ?? '',
    ...amounts(dto),
    currency: 'EGP',
    description: str(dto['description']),
    status: parseRequestStatus(dto['status']),
    expiresAt: str(dto['expiresAt']) ?? '',
    method: toSnapshot(dto),
    customerName: str(dto['customerName']),
    customerPhone: str(dto['customerPhone']),
    customerEmail: str(dto['customerEmail']),
    chatId: intOrNull(dto['chatId']),
    customerId: intOrNull(dto['customerId']),
    createdById: str(dto['createdById']) ?? '',
    createdByName: str(dto['createdByName']) ?? '—',
    createdAt: str(dto['createdAt']) ?? '',
    payerPhone: str(dto['payerPhone']),
    payerReference: str(dto['payerReference']),
    receiptUrl: str(dto['receiptUrl']),
    customerConfirmedAt: str(dto['customerConfirmedAt']),
    paidAt: str(dto['paidAt']),
    paidByName: str(dto['paidByName']),
    staffNote: str(dto['staffNote']),
    cancelledAt: str(dto['cancelledAt']),
    viewCount: num(dto['viewCount']),
    lastViewedAt: str(dto['lastViewedAt']),
  };
}

export function toPublicPayment(dto: Dto): PublicPayment {
  return {
    ...amounts(dto),
    currency: 'EGP',
    description: str(dto['description']),
    status: parseRequestStatus(dto['status']),
    expiresAt: str(dto['expiresAt']) ?? '',
    method: toSnapshot(dto),
    merchantName: str(dto['merchantName']) ?? 'The One System',
    customerName: str(dto['customerName']),
    customerConfirmedAt: str(dto['customerConfirmedAt']),
    paidAt: str(dto['paidAt']),
  };
}
