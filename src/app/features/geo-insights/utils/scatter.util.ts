/**
 * Scattering customer pins around a region centroid — pure, deterministic,
 * fully unit-tested.
 *
 * The backend gives us one coordinate per *governorate* (its centroid), never a
 * real address per customer. To still show "one pin per customer" we spread the
 * pins over a small disc around the centroid. The offset is seeded by a stable
 * id, so a given customer always lands on the same spot — pins don't jump when
 * the map re-renders, the theme flips, or a filter reloads the same person.
 *
 * The disc radius grows (slowly, by √count) with how many pins a region holds,
 * so 1000 pins over Cairo stay readable instead of piling into one blob, while a
 * region with three customers keeps them tight to its real centre.
 */

/** Degrees of latitude per kilometre — constant everywhere. */
const KM_PER_DEG_LAT = 110.574;
/** Egypt sits near 27° N; one degree of longitude ≈ this many km there. */
const KM_PER_DEG_LNG_EGYPT = 97.6;

/**
 * Smallest / largest scatter radius, in kilometres, around a centroid.
 *
 * The floor is wide enough that even three or four customers read as separate
 * dots rather than one clump — the pins are small, so they need room between
 * them. The ceiling keeps a thousand pins inside their governorate's vicinity.
 */
const MIN_RADIUS_KM = 14;
const MAX_RADIUS_KM = 48;
/** Pin count at which the radius reaches its maximum. */
const RADIUS_SATURATION = 600;

/** A single customer to place on the map. */
export interface ScatterSeed {
  /** Stable identity — the same id always produces the same offset. */
  id: number;
  /** Centroid the pin scatters around (its governorate's centre). */
  lat: number;
  lng: number;
}

/** A placed pin: the seed's id plus the jittered coordinate. */
export interface ScatterPoint {
  id: number;
  lat: number;
  lng: number;
}

/**
 * Mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Seeded by the
 * customer id so the sequence (and therefore the pin's position) is stable.
 */
function seededUnit(seed: number): () => number {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scatter radius (km) for a region holding `count` pins — √-eased so it grows gently. */
function radiusKm(count: number): number {
  const t = Math.min(1, Math.sqrt(Math.max(0, count) / RADIUS_SATURATION));
  return MIN_RADIUS_KM + (MAX_RADIUS_KM - MIN_RADIUS_KM) * t;
}

/**
 * Place `seeds` as pins. All seeds sharing a centroid scatter over one disc
 * whose size follows the group's own count, so pins of a dense governorate
 * spread wider than those of a sparse one even when drawn together.
 *
 * Invalid centroids (missing / non-finite lat-lng) are dropped — a pin with no
 * place can't be shown.
 */
export function scatterPoints(seeds: readonly ScatterSeed[]): ScatterPoint[] {
  const groups = new Map<string, ScatterSeed[]>();
  for (const s of seeds) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
    const key = `${s.lat},${s.lng}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }

  const points: ScatterPoint[] = [];
  for (const group of groups.values()) {
    const maxRadius = radiusKm(group.length);
    for (const seed of group) {
      const rand = seededUnit(seed.id);
      // Uniform over the disc: √u keeps density even (not centre-heavy).
      const distanceKm = Math.sqrt(rand()) * maxRadius;
      const angle = rand() * 2 * Math.PI;
      const dLat = (distanceKm * Math.sin(angle)) / KM_PER_DEG_LAT;
      const dLng = (distanceKm * Math.cos(angle)) / KM_PER_DEG_LNG_EGYPT;
      points.push({ id: seed.id, lat: seed.lat + dLat, lng: seed.lng + dLng });
    }
  }
  return points;
}
