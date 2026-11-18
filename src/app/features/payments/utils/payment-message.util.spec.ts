import { PaymentRequest } from '../models/payments.models';
import { buildPaymentMessage } from './payment-message.util';

function request(patch: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id: 41, token: 'tok', amount: 1000, currency: 'EGP', description: 'test', status: 'Pending',
    expiresAt: '2026-11-19T10:00:00Z',
    method: { methodId: 1, type: 'InstaPay', accountName: 'The One System', phoneNumber: null, instapayAddress: 'x@instapay', instapayLink: null, instructions: null },
    customerName: 'Ahmed Ali', customerPhone: null, customerEmail: null, chatId: 1, customerId: null,
    createdById: 'u', createdByName: 'Mohamed', createdAt: '2026-11-18T10:00:00Z',
    payerPhone: null, payerReference: null, receiptUrl: null, customerConfirmedAt: null, paidAt: null,
    paidByName: null, staffNote: null, cancelledAt: null, viewCount: 0, lastViewedAt: null, ...patch,
  };
}

describe('buildPaymentMessage', () => {
  it('names the company + agent, the reference and the account holder; bold on WhatsApp', () => {
    const text = buildPaymentMessage(request(), { lang: 'ar', company: 'The One System', agent: 'Mohamed Fathy', rich: true });
    expect(text).toContain('معاك Mohamed Fathy من *The One System*.');
    expect(text).toContain('طلب دفع رقم *#41*');
    expect(text).toContain('*1,000 ج.م*');
    expect(text).toContain('باسم The One System');
    expect(text).toContain('/pay/tok');
    expect(text).toContain('اكتب رقم الطلب #41');
  });

  it('stays plain text off WhatsApp and drops company lines when unknown', () => {
    const text = buildPaymentMessage(request({ description: null }), { lang: 'en', rich: false });
    expect(text).not.toContain('*');
    expect(text).not.toContain('This is');
    expect(text).not.toContain('For:');
    expect(text).toContain('Payment request #41');
  });

  it('puts the link alone on its line', () => {
    const lines = buildPaymentMessage(request(), { lang: 'ar' }).split('\n');
    expect(lines.some((l) => /^https?:\/\/\S+\/pay\/tok$/.test(l))).toBeTrue();
  });
});
