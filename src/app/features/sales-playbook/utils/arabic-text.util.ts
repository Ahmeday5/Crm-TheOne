/**
 * Arabic / English text normalisation — pure, no Angular, easy to unit-test.
 *
 * Used for search, fuzzy service matching and duplicate detection, so that
 * "برنامج الحسابات", "برنامج حسابات" and "بَرنامج الحسابات" compare equal.
 */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // harakat, small marks, tatweel
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/** Lower-cased, diacritic-free, unified letter forms, single spaces. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips the definite article from an Arabic word ("الحسابات" → "حسابات"; also "وال", "بال"…). */
function stripArticle(token: string): string {
  const m = /^(?:[وفبكل]?ال)(.{2,})$/.exec(token);
  return m ? m[1] : token;
}

/** Normalised words, article removed. */
export function tokenize(value: string | null | undefined): string[] {
  const text = normalizeText(value);
  return text ? text.split(' ').map(stripArticle).filter(Boolean) : [];
}

/** Space-free key — the identity used for duplicate detection. */
export function compactKey(value: string | null | undefined): string {
  return tokenize(value).join('');
}

/** Does `haystack` match every word of `query` (normalised, any order)? */
export function matchesQuery(query: string, ...haystack: Array<string | null | undefined>): boolean {
  const words = tokenize(query);
  if (!words.length) return true;
  const text = haystack.map((h) => tokenize(h).join(' ')).join(' ');
  return words.every((w) => text.includes(w));
}
