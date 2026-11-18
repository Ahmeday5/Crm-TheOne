import { parseMethodType, parseRequestStatus, toPaymentRequest, toPublicPayment } from './payments.mapper';

describe('payments.mapper', () => {
  it('reads enums as name, ordinal or the Arabic Swagger label', () => {
    expect(parseMethodType('VodafoneCash')).toBe('VodafoneCash');
    expect(parseMethodType('vodafonecash')).toBe('VodafoneCash');
    expect(parseMethodType(2)).toBe('EtisalatCash');
    expect(parseMethodType('فودافون كاش')).toBe('VodafoneCash');
    expect(parseMethodType('وي باي')).toBe('WePay');

    expect(parseRequestStatus('CustomerConfirmed')).toBe('CustomerConfirmed');
    expect(parseRequestStatus('4')).toBe('Expired');
    expect(parseRequestStatus('العميل أكّد التحويل')).toBe('CustomerConfirmed');
    expect(parseRequestStatus('تم الدفع')).toBe('Paid');
  });

  it('falls back safely on unknown values', () => {
    expect(parseMethodType('PayPal')).toBe('InstaPay');
    expect(parseRequestStatus(null)).toBe('Pending');
  });

  it('accepts the nested method snapshot (contract)', () => {
    const r = toPaymentRequest({
      id: 41, token: 't', amount: '1500.00', status: 'في انتظار الدفع',
      method: { methodId: 2, type: 'فودافون كاش', accountName: 'The One', phoneNumber: '01000000002' },
    });
    expect(r.amount).toBe(1500);
    expect(r.status).toBe('Pending');
    expect(r.method).toEqual(jasmine.objectContaining({ methodId: 2, type: 'VodafoneCash', phoneNumber: '01000000002' }));
    expect(r.createdByName).toBe('—');
  });

  it('accepts flat snapshot columns too', () => {
    const p = toPublicPayment({ amount: 10, status: 'Paid', methodType: 'InstaPay', methodInstapayAddress: 'x@instapay' });
    expect(p.method.type).toBe('InstaPay');
    expect(p.method.instapayAddress).toBe('x@instapay');
    expect(p.status).toBe('Paid');
  });
});
