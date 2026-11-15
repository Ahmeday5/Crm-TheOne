import {
  addMonthsToDay,
  buildRenewRequest,
  canRenew,
  defaultRenewalStart,
  monthsBetween,
  quickEndDate,
  renewalUrgency,
  suggestsRenewal,
  validateRenewal,
} from './contract-renewal.util';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-15T10:00:00Z');
const inDays = (n: number) => new Date(NOW + n * DAY).toISOString();
const TODAY = '2026-11-15';

describe('contract renewal rules', () => {
  it('never renews cancelled contracts', () => {
    expect(canRenew({ status: 'Cancelled' })).toBeFalse();
    expect(suggestsRenewal({ status: 'Cancelled', endDate: inDays(-3) }, NOW)).toBeFalse();
    expect(renewalUrgency({ status: 'Cancelled', endDate: inDays(-3) }, NOW)).toBeNull();
  });

  it('suggests renewal for expired and soon-ending contracts only', () => {
    expect(suggestsRenewal({ status: 'Expired', endDate: inDays(-40) }, NOW)).toBeTrue();
    expect(suggestsRenewal({ status: 'Active', endDate: inDays(10) }, NOW)).toBeTrue();
    expect(suggestsRenewal({ status: 'Active', endDate: inDays(30) }, NOW)).toBeTrue();
    expect(suggestsRenewal({ status: 'Active', endDate: inDays(45) }, NOW)).toBeFalse();
    expect(suggestsRenewal({ status: 'Active', endDate: null }, NOW)).toBeFalse();
  });

  it('flags row urgency', () => {
    expect(renewalUrgency({ status: 'Active', endDate: inDays(-1) }, NOW)).toBe('expired');
    expect(renewalUrgency({ status: 'Active', endDate: inDays(7) }, NOW)).toBe('expiring');
    expect(renewalUrgency({ status: 'Active', endDate: inDays(90) }, NOW)).toBeNull();
  });

  it('adds months and clamps to the month end', () => {
    expect(addMonthsToDay('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDay('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToDay('2026-11-15', 6)).toBe('2027-05-15');
    expect(addMonthsToDay('2026-12-31', 12)).toBe('2027-12-31');
  });

  it('defaults the new start to the day after the current end, or today', () => {
    expect(defaultRenewalStart({ endDate: '2026-12-31T00:00:00' }, TODAY)).toBe('2027-01-01');
    expect(defaultRenewalStart({ endDate: null }, TODAY)).toBe(TODAY);
  });

  it('extends quick picks from the current end — or from today once it has passed', () => {
    expect(quickEndDate({ endDate: '2026-12-31' }, 12, TODAY)).toBe('2027-12-31');
    expect(quickEndDate({ endDate: '2026-01-10' }, 6, TODAY)).toBe('2027-05-15');
    expect(quickEndDate({ endDate: null }, 12, TODAY)).toBe('2027-11-15');
  });

  it('mirrors the backend validation', () => {
    const contract = { status: 'Active' as const, endDate: '2026-12-31' };
    const ok = { newEndDate: '2027-12-31', newStartDate: '2027-01-01', newPrice: 100, notes: '' };
    expect(validateRenewal(contract, ok, TODAY)).toEqual([]);
    expect(validateRenewal(contract, { ...ok, newEndDate: '' }, TODAY)).toEqual(['endRequired']);
    expect(validateRenewal(contract, { ...ok, newEndDate: '2026-12-31' }, TODAY)).toContain('endNotAfterCurrent');
    expect(validateRenewal({ status: 'Expired', endDate: '2025-01-01' }, { ...ok, newEndDate: '2026-11-01', newStartDate: '' }, TODAY))
      .toEqual(['endInPast']);
    expect(validateRenewal(contract, { ...ok, newStartDate: '2028-01-01' }, TODAY)).toEqual(['startAfterEnd']);
    expect(validateRenewal(contract, { ...ok, newPrice: -1 }, TODAY)).toEqual(['negativePrice']);
    expect(validateRenewal({ status: 'Cancelled', endDate: null }, ok, TODAY)).toContain('cancelled');
  });

  it('sends only what differs from the backend defaults', () => {
    const contract = { endDate: '2026-12-31', price: 100 };
    expect(buildRenewRequest(contract, { newEndDate: '2027-12-31', newStartDate: '2027-01-01', newPrice: 100, notes: '  ' }, TODAY))
      .toEqual({ newEndDate: '2027-12-31' });
    expect(buildRenewRequest(contract, { newEndDate: '2027-12-31', newStartDate: '2027-02-01', newPrice: 150, notes: ' ok ' }, TODAY))
      .toEqual({ newEndDate: '2027-12-31', newStartDate: '2027-02-01', newPrice: 150, notes: 'ok' });
  });

  it('counts whole months', () => {
    expect(monthsBetween('2026-01-01', '2026-12-31')).toBe(11);
    expect(monthsBetween('2026-01-01', '2027-01-01')).toBe(12);
  });
});
