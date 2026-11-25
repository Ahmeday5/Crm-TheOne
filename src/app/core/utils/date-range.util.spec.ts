import {
  dateRangeFromParams,
  isDateRangeActive,
  isDateRangeInverted,
  isIsoDay,
  matchDateRangePreset,
  normalizeDateRange,
  presetDateRange,
  sameDateRange,
  toDateRangeParams,
} from './date-range.util';

/** Fixed "today" so preset maths is deterministic. */
const TODAY = '2026-11-25';

describe('date-range.util', () => {
  describe('isIsoDay', () => {
    it('accepts real yyyy-MM-dd days', () => {
      expect(isIsoDay('2026-11-25')).toBeTrue();
      expect(isIsoDay('2028-02-29')).toBeTrue(); // leap day
    });

    it('rejects impossible days, other formats and empties', () => {
      expect(isIsoDay('2026-02-31')).toBeFalse();
      expect(isIsoDay('2027-02-29')).toBeFalse();
      expect(isIsoDay('25/11/2026')).toBeFalse();
      expect(isIsoDay('2026-11-25T00:00:00')).toBeFalse();
      expect(isIsoDay('')).toBeFalse();
      expect(isIsoDay(null)).toBeFalse();
      expect(isIsoDay(undefined)).toBeFalse();
    });
  });

  describe('toDateRangeParams (API contract)', () => {
    it('maps both bounds to From / To', () => {
      expect(toDateRangeParams({ from: '2026-11-01', to: '2026-11-23' })).toEqual({
        From: '2026-11-01',
        To: '2026-11-23',
      });
    });

    it('omits empty or missing bounds — never sends "" or null', () => {
      expect(toDateRangeParams({})).toEqual({});
      expect(toDateRangeParams(null)).toEqual({});
      expect(toDateRangeParams({ from: '', to: '' })).toEqual({});
      expect(toDateRangeParams({ from: '2026-11-01' })).toEqual({ From: '2026-11-01' });
      expect(toDateRangeParams({ to: '2026-11-23' })).toEqual({ To: '2026-11-23' });
    });

    it('drops malformed bounds instead of forwarding them', () => {
      expect(toDateRangeParams({ from: '2026-13-01', to: 'tomorrow' })).toEqual({});
    });

    it('produces keys that are absent, not undefined, so a spread adds nothing', () => {
      expect(Object.keys(toDateRangeParams({ from: '2026-11-01' }))).toEqual(['From']);
    });
  });

  describe('range state helpers', () => {
    it('normalizeDateRange keeps only valid bounds', () => {
      expect(normalizeDateRange({ from: 'x', to: '2026-11-01' })).toEqual({ to: '2026-11-01' });
    });

    it('isDateRangeActive is true when either bound is set', () => {
      expect(isDateRangeActive({})).toBeFalse();
      expect(isDateRangeActive({ from: '2026-11-01' })).toBeTrue();
      expect(isDateRangeActive({ to: '2026-11-01' })).toBeTrue();
    });

    it('isDateRangeInverted flags From > To only (same day is valid)', () => {
      expect(isDateRangeInverted({ from: '2026-11-02', to: '2026-11-01' })).toBeTrue();
      expect(isDateRangeInverted({ from: '2026-11-01', to: '2026-11-01' })).toBeFalse();
      expect(isDateRangeInverted({ from: '2026-11-02' })).toBeFalse();
    });

    it('sameDateRange compares normalized values', () => {
      expect(sameDateRange({}, { from: '' })).toBeTrue();
      expect(sameDateRange({ from: '2026-11-01' }, { from: '2026-11-02' })).toBeFalse();
    });
  });

  describe('presetDateRange', () => {
    it('today', () => {
      expect(presetDateRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    });

    it('last 7 days includes today (7 calendar days)', () => {
      expect(presetDateRange('last7Days', TODAY)).toEqual({ from: '2026-11-19', to: TODAY });
    });

    it('this month runs from the 1st to today', () => {
      expect(presetDateRange('thisMonth', TODAY)).toEqual({ from: '2026-11-01', to: TODAY });
    });

    it('last month is the full previous month', () => {
      expect(presetDateRange('lastMonth', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    });

    it('last month crosses the year boundary in January', () => {
      expect(presetDateRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });

    it('matchDateRangePreset recognises a preset range and nothing else', () => {
      const presets = ['today', 'last7Days', 'thisMonth', 'lastMonth'] as const;
      expect(matchDateRangePreset({ from: '2026-11-01', to: TODAY }, presets, TODAY)).toBe('thisMonth');
      expect(matchDateRangePreset({ from: '2026-11-02', to: TODAY }, presets, TODAY)).toBeNull();
      expect(matchDateRangePreset({}, presets, TODAY)).toBeNull();
    });
  });

  describe('dateRangeFromParams (URL deep links)', () => {
    it('reads valid ?from / ?to', () => {
      expect(dateRangeFromParams('2026-11-01', '2026-11-23')).toEqual({ from: '2026-11-01', to: '2026-11-23' });
    });

    it('drops an inverted pair rather than forwarding a 400 to the API', () => {
      expect(dateRangeFromParams('2026-11-23', '2026-11-01')).toEqual({});
    });

    it('ignores missing / garbage values', () => {
      expect(dateRangeFromParams(null, null)).toEqual({});
      expect(dateRangeFromParams('nope', '2026-11-01')).toEqual({ to: '2026-11-01' });
    });
  });
});
