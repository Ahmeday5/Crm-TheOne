import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { DiscountApprovalType } from '../models/discount-approvals.models';

/** What the quotation form needs to come back exactly as the rep left it. */
export interface PriceQuotationDraft {
  quotationId: number | null;
  customerId: number | null;
  discount: number;
  notes: string;
  items: { serviceId: number; serviceName: string; unitPrice: number; quantity: number }[];
}

/** What the payment-link panel needs to come back as the rep left it. */
export interface PaymentRequestDraft {
  chatId: number | null;
  methodId: number | null;
  amount: number | null;
  discount: number | null;
  description: string;
  validityDays: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

interface DraftsByType {
  PriceQuotation: PriceQuotationDraft;
  PaymentRequest: PaymentRequestDraft;
}

export interface DiscountDraft<T extends DiscountApprovalType = DiscountApprovalType> {
  approvalId: number;
  type: T;
  savedAt: number;
  payload: DraftsByType[T];
}

/** A draft outlives the code (valid today + tomorrow) by a little. */
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_DRAFTS = 50;

/**
 * Keeps the form a discount request was made from, so the rep can close it
 * while the manager decides and pick it up again from the notification or
 * from «موافقات الخصم» — values restored and the approved code filled in.
 *
 * Per user, in this browser only: a convenience, not business state. The
 * approval itself (status, code) always comes from the server; without a
 * draft (another device) the rep re-enters the form and the code fills in.
 */
@Injectable({ providedIn: 'root' })
export class DiscountDraftsService {
  private readonly auth = inject(AuthService);

  save<T extends DiscountApprovalType>(approvalId: number, type: T, payload: DraftsByType[T]): void {
    const drafts = this.read().filter((d) => d.approvalId !== approvalId);
    drafts.unshift({ approvalId, type, savedAt: Date.now(), payload });
    this.write(drafts.slice(0, MAX_DRAFTS));
  }

  get<T extends DiscountApprovalType>(approvalId: number, type: T): DiscountDraft<T> | null {
    const draft = this.read().find((d) => d.approvalId === approvalId && d.type === type);
    return (draft as DiscountDraft<T> | undefined) ?? null;
  }

  has(approvalId: number): boolean {
    return this.read().some((d) => d.approvalId === approvalId);
  }

  /** The type of the draft kept for an approval, if any. */
  typeOf(approvalId: number): DiscountApprovalType | null {
    return this.read().find((d) => d.approvalId === approvalId)?.type ?? null;
  }

  remove(approvalId: number | null | undefined): void {
    if (approvalId == null) return;
    this.write(this.read().filter((d) => d.approvalId !== approvalId));
  }

  private key(): string | null {
    const userId = this.auth.currentUser()?.userId;
    return userId ? `crm.discountDrafts.${userId}` : null;
  }

  private read(): DiscountDraft[] {
    const key = this.key();
    if (!key) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      const now = Date.now();
      return Array.isArray(parsed)
        ? parsed.filter((d): d is DiscountDraft => !!d && typeof d.approvalId === 'number' && now - d.savedAt < TTL_MS)
        : [];
    } catch {
      return [];
    }
  }

  private write(drafts: DiscountDraft[]): void {
    const key = this.key();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(drafts));
    } catch {
      /* storage full / blocked — resuming just won't restore the form */
    }
  }
}
