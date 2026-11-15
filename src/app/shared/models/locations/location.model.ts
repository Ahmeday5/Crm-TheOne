/**
 * Country / Egyptian-governorate lookups and the location fields a customer
 * carries (`docs`: backend changes of 2026-11-15).
 */

/** `GET /Campaigns/dropdownCountries` — the campaign picker's list, now with geo fields. */
export interface Country {
  id: number;
  /** Arabic name. */
  name: string;
  /** ISO 3166-1 alpha-2, e.g. `EG` — joins the world map and the flag. */
  iso2: string;
  dialCode: string;
  lat: number;
  lng: number;
}

/** `GET /Customers/governorates` — Egypt's 27 governorates. */
export interface Governorate {
  id: number;
  /** Arabic name. */
  name: string;
  nameEn: string;
  /** ISO 3166-2, e.g. `EG-C` — joins the Egypt map. */
  code: string;
  lat: number;
  lng: number;
}

/** Egypt's id in the countries lookup — the only country with governorates. */
export const EGYPT_COUNTRY_ID = 20;

/**
 * "Clear this value" on `PUT /Customers/updateCustomer/{id}`. `null` /
 * omitted keeps the stored value there, so clearing needs an explicit `0`.
 */
export const CLEAR_LOCATION_ID = 0;

/** Location fields on every customer read (lists, search, details). */
export interface CustomerLocation {
  /** Effective country — stored, or inferred from the phone dial code. */
  countryId?: number | null;
  countryName?: string | null;
  countryIso2?: string | null;
  /** True when nobody chose the country — it was guessed from the phone number. */
  countryInferred?: boolean;
  governorateId?: number | null;
  governorateName?: string | null;
}
