import { DiscountBinding } from '../models/discount-approvals.models';

/** Money as sent to the API — two decimals. */
export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Discount as a percentage of the amount before it (0 when there is no amount). */
export function discountPercent(amount: number | null | undefined, discount: number | null | undefined): number {
  const a = Number(amount) || 0;
  const d = Number(discount) || 0;
  if (a <= 0 || d <= 0) return 0;
  return (d / a) * 100;
}

/** `12.5` → `"12.5"`, `15` → `"15"` — for "يعني X% من المبلغ" and badges. */
export function formatPercent(percent: number): string {
  return (Math.round(percent * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** Stable key of a binding — a code is valid only for the key it was issued for. */
export function bindingKey(b: DiscountBinding): string {
  return [b.type, b.customerId ?? '-', round2(b.amount).toFixed(2), round2(b.discount).toFixed(2)].join('|');
}

/** A 6-digit code as typed (spaces / dashes removed). */
export function normalizeCode(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** `https://wa.me/?text=…` — the user picks the contact (the manager) in WhatsApp. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Absolute link to the Admin page for one request. */
export function approvalPageUrl(id: number): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/discount-approvals/${id}`;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
