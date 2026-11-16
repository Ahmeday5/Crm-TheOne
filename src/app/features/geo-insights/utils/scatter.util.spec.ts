import { ScatterSeed, scatterPoints } from './scatter.util';

function seed(id: number, lat = 30, lng = 31): ScatterSeed {
  return { id, lat, lng };
}

describe('scatterPoints', () => {
  it('places one pin per valid seed', () => {
    const pins = scatterPoints([seed(1), seed(2), seed(3)]);
    expect(pins.length).toBe(3);
    expect(pins.map((p) => p.id).sort()).toEqual([1, 2, 3]);
  });

  it('is deterministic — the same id always lands on the same spot', () => {
    const a = scatterPoints([seed(42)])[0];
    const b = scatterPoints([seed(42)])[0];
    expect(b.lat).toBe(a.lat);
    expect(b.lng).toBe(a.lng);
  });

  it('spreads pins out — distinct ids do not collapse onto the centroid', () => {
    const pins = scatterPoints([seed(1), seed(2)]);
    expect(pins[0].lat).not.toBe(pins[1].lat);
    // Neither sits exactly on the centroid.
    expect(pins.some((p) => p.lat === 30 && p.lng === 31)).toBe(false);
  });

  it('keeps pins within a sane radius of the centroid (≈ < 0.6°)', () => {
    const pins = scatterPoints(Array.from({ length: 200 }, (_, i) => seed(i + 1)));
    for (const p of pins) {
      expect(Math.abs(p.lat - 30)).toBeLessThan(0.6);
      expect(Math.abs(p.lng - 31)).toBeLessThan(0.6);
    }
  });

  it('drops seeds with a missing or non-finite centroid', () => {
    const pins = scatterPoints([
      seed(1),
      { id: 2, lat: NaN, lng: 31 },
      { id: 3, lat: 30, lng: Infinity },
    ]);
    expect(pins.map((p) => p.id)).toEqual([1]);
  });

  it('scatters a dense region wider than a sparse one', () => {
    const spread = (n: number) => {
      const pins = scatterPoints(Array.from({ length: n }, (_, i) => seed(i + 1)));
      return Math.max(...pins.map((p) => Math.abs(p.lat - 30)));
    };
    expect(spread(500)).toBeGreaterThan(spread(5));
  });
});
