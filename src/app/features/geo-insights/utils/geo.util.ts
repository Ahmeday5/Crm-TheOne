import { EGYPT_COUNTRY_ID } from '../../../shared/models/locations/location.model';
import {
  GeoAggregate,
  GeoCountry,
  GeoGovernorate,
  MapSelection,
  RegionFilter,
  StatusCount,
} from '../models/geo.models';

/** Pure helpers for the geographic maps — no Angular, fully unit-tested. */

/** Query → HTTP params: empty filters are dropped, `governorateId = 0` is kept. */
export function toMapParams(q: object): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(q)) {
    if (value === null || value === undefined || value === '') continue;
    params[key] = typeof value === 'string' ? value.trim() : value;
  }
  return params;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const list = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);
const statuses = (v: StatusCount[] | null | undefined): StatusCount[] =>
  list(v).filter((s) => num(s?.count) > 0).sort((a, b) => b.count - a.count);

/** Defensive read: missing arrays / numbers become empty / zero, lists stay sorted by count. */
export function normalizeGeoAggregate(raw: Partial<GeoAggregate> | null | undefined): GeoAggregate {
  const countries = list(raw?.countries)
    .map((c): GeoCountry => ({
      ...c,
      count: num(c.count),
      percentage: num(c.percentage),
      inferredCount: num(c.inferredCount),
      byStatus: statuses(c.byStatus),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const governorates = list(raw?.governorates)
    .map((g): GeoGovernorate => ({ ...g, count: num(g.count), percentage: num(g.percentage), byStatus: statuses(g.byStatus) }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    total: num(raw?.total),
    located: num(raw?.located),
    unknown: num(raw?.unknown),
    countriesCount: num(raw?.countriesCount) || countries.length,
    countries,
    unknownByStatus: statuses(raw?.unknownByStatus),
    governorates,
    egyptWithoutGovernorate: num(raw?.egyptWithoutGovernorate),
  };
}

export function egyptOf(data: GeoAggregate): GeoCountry | null {
  return data.countries.find((c) => c.countryId === EGYPT_COUNTRY_ID) ?? null;
}

/** The list filter for a selected region (`countryId=0` = unknown, `governorateId=0` = none). */
export function regionFilterOf(s: MapSelection): RegionFilter {
  switch (s.kind) {
    case 'country': return { countryId: s.country.countryId };
    case 'governorate': return { countryId: EGYPT_COUNTRY_ID, governorateId: s.governorate.governorateId };
    case 'unknown': return { countryId: 0 };
    case 'egyptNoGovernorate': return { countryId: EGYPT_COUNTRY_ID, governorateId: 0 };
  }
}

/** Join keys with the boundary files: ISO-2 for countries, ISO 3166-2 for governorates. */
export const countryKey = (c: Pick<GeoCountry, 'iso2'>): string => (c.iso2 ?? '').trim().toUpperCase();
export const governorateKey = (g: Pick<GeoGovernorate, 'code'>): string => (g.code ?? '').trim().toUpperCase();

/** Tooltip / popup HTML is built by hand — every API string goes through here. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** A bucket of the sequential (one-hue, light → dark) colour scale. */
export interface CountBucket {
  min: number;
  max: number;
}

/**
 * Up to `steps` buckets covering 1…max. Small ranges get one bucket per
 * value; larger ones grow geometrically (customers cluster in a few
 * countries, so linear steps would paint everything else the lightest shade).
 * Bounds are rounded to readable numbers and never overlap.
 */
export function countBuckets(max: number, steps = 5): CountBucket[] {
  const top = Math.max(0, Math.floor(max));
  if (top === 0) return [];
  if (top <= steps) return Array.from({ length: top }, (_, i) => ({ min: i + 1, max: i + 1 }));

  const uppers: number[] = [];
  for (let i = 1; i <= steps; i++) {
    const raw = i === steps ? top : Math.pow(top, i / steps);
    const upper = i === steps ? top : niceRound(raw);
    if (upper > (uppers[uppers.length - 1] ?? 0) && upper <= top) uppers.push(upper);
  }
  if (uppers[uppers.length - 1] !== top) uppers.push(top);

  let min = 1;
  return uppers.map((upper) => {
    const bucket = { min, max: upper };
    min = upper + 1;
    return bucket;
  });
}

function niceRound(n: number): number {
  if (n < 10) return Math.round(n);
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / magnitude) * magnitude;
}

/** Index of the bucket holding `count` (−1 for 0 / out of range). */
export function bucketIndex(count: number, buckets: readonly CountBucket[]): number {
  return buckets.findIndex((b) => count >= b.min && count <= b.max);
}

/** `Date` → `yyyy-MM-dd` (local calendar day — what the user picked). */
export function toIsoDay(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Share of `part` in `whole` as a 0–100 number with one decimal. */
export function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}
