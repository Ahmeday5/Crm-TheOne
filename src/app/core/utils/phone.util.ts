/**
 * Phone-number helpers used to build `tel:` and `wa.me` deep links from the
 * customer phone strings that arrive from the backend.
 *
 * Backend numbers are not normalized — they come in as `01154113708`,
 * `+201154113708`, `00201154113708`, or with embedded spaces / dashes.
 *
 * Country fallback: any local number that starts with a single `0` is
 * assumed Egyptian (country code 20) — this matches the dataset shipped
 * with the app today. If the format ever needs to support more regions,
 * pull the default code from `environment` instead of hard-coding it.
 */

const DEFAULT_COUNTRY_CODE = '20';

/** Strips everything that isn't a digit. */
function stripNonDigits(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Normalize a raw phone string into an international form **without** the
 * leading `+` — suitable for `wa.me/<digits>` and tel hrefs.
 *
 * Returns `null` if the input has too few digits to be a real number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = stripNonDigits(raw);
  if (digits.length < 7) return null;

  // Already international: `00…` or `+…` (the `+` was stripped above).
  if (digits.startsWith('00')) return digits.slice(2);

  // Egyptian-style local number: leading `0` → swap for the country code.
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);

  // Plain digits — assume the caller already passed E.164 without the `+`.
  return digits;
}

/** Build a `tel:+…` href, or `null` if the number isn't usable. */
export function toTelHref(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `tel:+${n}` : null;
}

/** Build a `https://wa.me/…` URL, or `null` if the number isn't usable. */
export function toWhatsAppHref(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `https://wa.me/${n}` : null;
}
