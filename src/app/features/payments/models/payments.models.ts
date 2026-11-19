/**
 * Manual payment links ("طلب دفعة") — contract: `docs/api/payments.md`.
 *
 * The CRM never moves money. An Admin saves the accounts the company is paid
 * on (InstaPay + the four mobile wallets); staff create a request from a chat,
 * the customer opens `/pay/:token`, which jumps straight into the right app
 * (or dials the USSD code), and staff confirm the transfer by hand.
 */

/** InstaPay or one of Egypt's four mobile wallets. */
export type PaymentMethodType = 'InstaPay' | 'VodafoneCash' | 'EtisalatCash' | 'OrangeCash' | 'WePay';

export const PAYMENT_METHOD_TYPES: readonly PaymentMethodType[] = [
  'InstaPay',
  'VodafoneCash',
  'EtisalatCash',
  'OrangeCash',
  'WePay',
];

export const WALLET_TYPES: readonly PaymentMethodType[] = ['VodafoneCash', 'EtisalatCash', 'OrangeCash', 'WePay'];

export function isWallet(type: PaymentMethodType): boolean {
  return type !== 'InstaPay';
}

/** An account the company receives money on (managed by Admin). */
export interface PaymentMethod {
  id: number;
  type: PaymentMethodType;
  /** Account holder exactly as the payer's app will show it, e.g. "محمد فتحي محمد". */
  accountName: string;
  /** Wallet number (wallets: required) / InstaPay mobile (optional). Local format `01xxxxxxxxx`. */
  phoneNumber: string | null;
  /** InstaPay only — IPA, e.g. `theone@instapay`. */
  instapayAddress: string | null;
  /** InstaPay only — the account's payment link from the InstaPay app (`https://ipn.eg/S/…`). */
  instapayLink: string | null;
  /** Shown to the payer under the account (e.g. "اكتب رقم الفاتورة في الملاحظات"). */
  instructions: string | null;
  currency: 'EGP';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface PaymentMethodInput {
  type: PaymentMethodType;
  accountName: string;
  phoneNumber: string | null;
  instapayAddress: string | null;
  instapayLink: string | null;
  instructions: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type PaymentRequestStatus = 'Pending' | 'CustomerConfirmed' | 'Paid' | 'Cancelled' | 'Expired';

export const PAYMENT_REQUEST_STATUSES: readonly PaymentRequestStatus[] = [
  'Pending',
  'CustomerConfirmed',
  'Paid',
  'Cancelled',
  'Expired',
];

/**
 * The method as it was when the request was created — editing or deleting
 * the method later never changes a link already sent.
 */
export interface PaymentMethodSnapshot {
  methodId: number | null;
  type: PaymentMethodType;
  accountName: string;
  phoneNumber: string | null;
  instapayAddress: string | null;
  instapayLink: string | null;
  instructions: string | null;
}

/** Staff view of one request. */
export interface PaymentRequest {
  id: number;
  /** Unguessable public token — the link is `/pay/{token}`. */
  token: string;
  amount: number;
  currency: 'EGP';
  description: string | null;
  status: PaymentRequestStatus;
  expiresAt: string;
  method: PaymentMethodSnapshot;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  chatId: number | null;
  customerId: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  /** Filled by the payer on the public page ("I've transferred"). */
  payerPhone: string | null;
  payerReference: string | null;
  receiptUrl: string | null;
  customerConfirmedAt: string | null;
  paidAt: string | null;
  paidByName: string | null;
  staffNote: string | null;
  cancelledAt: string | null;
  /** Times the public page was opened. */
  viewCount: number;
  lastViewedAt: string | null;
}

export interface CreatePaymentRequestInput {
  methodId: number;
  amount: number;
  description: string | null;
  /** 1–90 days. */
  validityDays: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  chatId: number | null;
  customerId: number | null;
}

export interface PaymentRequestQuery {
  pageIndex?: number;
  pageSize?: number;
  status?: PaymentRequestStatus | null;
  search?: string | null;
  chatId?: number | null;
}

/** What the anonymous payer sees on `/pay/:token` — no staff fields. */
export interface PublicPayment {
  amount: number;
  currency: 'EGP';
  description: string | null;
  status: PaymentRequestStatus;
  expiresAt: string;
  method: PaymentMethodSnapshot;
  /** Company name shown on top of the page. */
  merchantName: string;
  customerName: string | null;
  customerConfirmedAt: string | null;
  paidAt: string | null;
}

export interface PublicPaymentConfirmInput {
  payerPhone: string | null;
  payerReference: string | null;
  /** Required (JPG/PNG/WEBP ≤ 5 MB) — frontend check + backend 400 `INVALID_FILE`. */
  receipt: File | null;
}
