import { EGYPT_COUNTRY_ID } from '../../../shared/models/locations/location.model';
import { GeoCountry } from '../models/geo.models';
import {
  bucketIndex,
  countBuckets,
  countryKey,
  egyptOf,
  escapeHtml,
  governorateKey,
  normalizeGeoAggregate,
  regionFilterOf,
  share,
  toIsoDay,
  toMapParams,
} from './geo.util';

function country(patch: Partial<GeoCountry>): GeoCountry {
  return {
    countryId: 1, name: 'x', iso2: 'XX', lat: 0, lng: 0,
    count: 1, percentage: 0, inferredCount: 0, byStatus: [], ...patch,
  };
}

describe('geo utils', () => {
  it('drops empty filters but keeps governorateId = 0 ("no governorate")', () => {
    expect(toMapParams({ customerStatusId: null, sourceId: undefined, governorateId: 0, from: '', to: '2026-11-15' }))
      .toEqual({ governorateId: 0, to: '2026-11-15' });
  });

  it('maps a selection to the list filter', () => {
    expect(regionFilterOf({ kind: 'country', country: country({ countryId: 4 }) })).toEqual({ countryId: 4 });
    expect(regionFilterOf({ kind: 'unknown', count: 1, byStatus: [] })).toEqual({ countryId: 0 });
    expect(regionFilterOf({ kind: 'egyptNoGovernorate', count: 1 })).toEqual({ countryId: EGYPT_COUNTRY_ID, governorateId: 0 });
  });

  it('builds join keys and escapes HTML', () => {
    expect(countryKey({ iso2: ' eg ' })).toBe('EG');
    expect(governorateKey({ code: 'eg-c' })).toBe('EG-C');
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });

  it('normalizes a partial payload and keeps lists sorted by count', () => {
    const data = normalizeGeoAggregate({
      total: 9,
      countries: [country({ countryId: 2, count: 2 }), country({ countryId: EGYPT_COUNTRY_ID, count: 7 }), country({ countryId: 3, count: 0 })],
    });
    expect(data.countries.map((c) => c.countryId)).toEqual([EGYPT_COUNTRY_ID, 2]);
    expect(data.governorates).toEqual([]);
    expect(data.unknown).toBe(0);
    expect(data.countriesCount).toBe(2);
    expect(egyptOf(data)?.count).toBe(7);
    expect(normalizeGeoAggregate(null).total).toBe(0);
  });

  it('builds one bucket per value for small ranges', () => {
    expect(countBuckets(3)).toEqual([{ min: 1, max: 1 }, { min: 2, max: 2 }, { min: 3, max: 3 }]);
    expect(countBuckets(0)).toEqual([]);
  });

  it('builds contiguous, non-overlapping buckets that end at the max', () => {
    for (const max of [6, 37, 120, 4870]) {
      const buckets = countBuckets(max);
      expect(buckets[0].min).toBe(1);
      expect(buckets[buckets.length - 1].max).toBe(max);
      expect(buckets.length).toBeLessThanOrEqual(6);
      buckets.forEach((b, i) => {
        expect(b.max).toBeGreaterThanOrEqual(b.min);
        if (i > 0) expect(b.min).toBe(buckets[i - 1].max + 1);
      });
      expect(bucketIndex(max, buckets)).toBe(buckets.length - 1);
      expect(bucketIndex(1, buckets)).toBe(0);
    }
    expect(bucketIndex(0, countBuckets(10))).toBe(-1);
  });

  it('formats calendar days and shares', () => {
    expect(toIsoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDay(null)).toBeNull();
    expect(share(1, 3)).toBe(33.3);
    expect(share(1, 0)).toBe(0);
  });
});
