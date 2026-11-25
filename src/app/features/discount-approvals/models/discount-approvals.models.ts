/**
 * Manager approval for discounts above the limit — contract:
 * `docs/backend-prompt-inbox-v4.md` §9.
 *
 * A non-Admin giving a discount above `discountApprovalThresholdPercent` on a
 * price quotation or a payment link needs a 6-digit code issued by an Admin.
 * The code is bound to the same type + customer + amount + discount, is valid
 * today and tomorrow (Cairo) and works once.
 */

export type DiscountApprovalType = 'PriceQuotation' | 'PaymentRequest';

export type DiscountApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Used' | 'Expired';

export const DISCOUNT_APPROVAL_STATUSES: readonly DiscountApprovalStatus[] = [
  'Pending',
  'Approved',
  'Rejected',
  'Used',
  'Expired',
];

export interface DiscountApproval {
  id: number;
  type: DiscountApprovalType;
  customerId: number | null;
  customerName: string;
  /** Total before the discount. */
  amount: number;
  discount: number;
  netAmount: number;
  percent: number;
  status: DiscountApprovalStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  /** Only returned to Admins and to the requester after approval. */
  code: string | null;
  /** End of tomorrow, Cairo time. */
  validUntil: string | null;
  rejectReason: string | null;
  /** Quotation / payment request that used it (or the quotation being edited). */
  referenceId: number | null;
}

/** Body of `POST DiscountApprovals`. */
export interface CreateDiscountApprovalInput {
  type: DiscountApprovalType;
  /**
   * Contract types it as `number`; a payment link from a chat that is not
   * linked to a CRM customer has none, so `null` is sent then.
   */
  customerId: number | null;
  /** Total before discount. */
  amount: number;
  discount: number;
  /** Quotation id when editing an existing quotation. */
  referenceId: number | null;
}

export interface DiscountApprovalQuery {
  status?: DiscountApprovalStatus | null;
  pageIndex?: number;
  pageSize?: number;
}

/** `GET Settings/sales-rules`. */
export interface SalesRules {
  discountApprovalThresholdPercent: number;
  awaitingReplyThresholdMinutes: number;
}

/** Used when the settings call fails or is not deployed yet. */
export const DEFAULT_DISCOUNT_THRESHOLD_PERCENT = 10;

/** What a code is bound to (§9.3: same type, customer, amount and discount). */
export interface DiscountBinding {
  type: DiscountApprovalType;
  customerId: number | null;
  amount: number;
  discount: number;
}
