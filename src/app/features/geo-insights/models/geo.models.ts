/**
 * Geographic aggregate (`GET /Customers/map`): how many records sit in each
 * country, and in each governorate inside Egypt. Kept generic so another
 * entity can reuse the explorer with the same shape.
 *
 * Invariants the UI relies on:
 *   sum(countries.count) + unknown === total
 *   sum(governorates.count) + egyptWithoutGovernorate === Egypt's count
 */

export interface StatusCount {
  /** Backend status id (customers: 1, 3, 4, 5). */
  statusId: number;
  /** Backend enum name (`Buyer`, `InProgress`…) — localised by the page's `statusLabel`. */
  status: string;
  count: number;
}

export interface GeoCountry {
  countryId: number;
  name: string;
  iso2: string;
  lat: number;
  lng: number;
  count: number;
  /** % of `total`. */
  percentage: number;
  /** How many of `count` were guessed from the customer's phone number. */
  inferredCount: number;
  byStatus: StatusCount[];
}

export interface GeoGovernorate {
  governorateId: number;
  name: string;
  nameEn: string;
  /** ISO 3166-2, e.g. `EG-C` — joins `egypt.geo.json`. */
  code: string;
  lat: number;
  lng: number;
  count: number;
  /** % of Egypt's records. */
  percentage: number;
  byStatus: StatusCount[];
}

export interface GeoAggregate {
  total: number;
  /** Country known. */
  located: number;
  /** Country unknown (no phone / no dial code). */
  unknown: number;
  countriesCount: number;
  /** Sorted by count, descending. */
  countries: GeoCountry[];
  unknownByStatus: StatusCount[];
  /** Egypt only, sorted by count, descending. */
  governorates: GeoGovernorate[];
  egyptWithoutGovernorate: number;
}

/** Which map is on screen. */
export type MapLevel = 'world' | 'egypt';

/**
 * A region the user drilled into (side panel). `unknown` and
 * `egyptNoGovernorate` are the two buckets that have no shape on a map.
 */
export type MapSelection =
  | { kind: 'country'; country: GeoCountry }
  | { kind: 'governorate'; governorate: GeoGovernorate }
  | { kind: 'unknown'; count: number; byStatus: StatusCount[] }
  | { kind: 'egyptNoGovernorate'; count: number };

/** The list filter a selection maps to (`countryId=0` = unknown, `governorateId=0` = none). */
export interface RegionFilter {
  countryId?: number;
  governorateId?: number;
}

/** Labels the explorer / panel need from the page (customers vs tickets). */
export interface GeoUnitLabels {
  /** i18n key of the plural unit ("عميل" / "تذكرة"). */
  unitKey: string;
  /** Localise a backend status name. */
  statusLabel: (status: string) => string;
}
