/**
 * Models for the `CompanySettings/*` endpoints.
 *
 * These drive the app's white-label identity: the logo / favicon shown in the
 * shell, the company name in the header, and the default currency used to
 * format money across the app. One tenant ⇒ one row (`id: 1`).
 */

/** Company settings as returned by `GET /CompanySettings` (unwrapped `data`). */
export interface CompanySettings {
  id: number;
  companyName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  address: string | null;
  commercialRegistration: string | null;
  taxNumber: string | null;
  /** Server-relative path, e.g. `/Images/CompanySettings/â€¦png`. */
  logoUrl: string | null;
  /** Server-relative path. */
  faviconUrl: string | null;
  defaultCurrency: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Editable fields for `POST /CompanySettings/Update` (multipart/form-data).
 *
 * `logo` / `favicon` are optional `File`s — omit them to keep the current
 * image. Everything else is a plain string field.
 */
export interface UpdateCompanySettingsForm {
  companyName: string;
  tradeName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  commercialRegistration: string;
  taxNumber: string;
  defaultCurrency: string;
  logo?: File | null;
  favicon?: File | null;
}
