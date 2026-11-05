import { compactKey, tokenize } from './arabic-text.util';

/**
 * Fuzzy "which service is this program?" matching — pure.
 *
 * A program is described by several aliases (Arabic singular/plural,
 * English). A service scores against an alias by, in order of strength:
 *   1. identical space-free key                         → 1
 *   2. one key contains the other (≥ 4 letters)         → 0.9
 *   3. word overlap, where two words match when equal or
 *      sharing a long prefix ("عياده" ~ "عيادات")       → 0…0.85
 * The best service above `MIN_SCORE` wins; ties keep the first one.
 */

export interface ServiceCandidate {
  id: number;
  nameAr: string;
  nameEn: string;
}

const MIN_SCORE = 0.6;
const MIN_CONTAINS_LENGTH = 4;

/** Two words are "the same" when equal, or (≥ 4 letters) sharing ≥ 80 % of the shorter one as a prefix. */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  let i = 0;
  while (i < shorter && a[i] === b[i]) i++;
  return i / shorter >= 0.8;
}

/** Similarity of one alias to one name, 0…1. */
export function nameSimilarity(alias: string, name: string): number {
  const ka = compactKey(alias);
  const kn = compactKey(name);
  if (!ka || !kn) return 0;
  if (ka === kn) return 1;
  const short = ka.length <= kn.length ? ka : kn;
  const long = short === ka ? kn : ka;
  if (short.length >= MIN_CONTAINS_LENGTH && long.includes(short)) return 0.9;

  const aliasWords = tokenize(alias);
  const nameWords = tokenize(name);
  if (!aliasWords.length || !nameWords.length) return 0;
  const hits = aliasWords.filter((w) => nameWords.some((n) => wordsMatch(w, n))).length;
  return (hits / aliasWords.length) * 0.85;
}

/** Best matching service for a program, or `null` when nothing is similar enough. */
export function findSimilarService<T extends ServiceCandidate>(
  aliases: readonly string[],
  services: readonly T[],
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const service of services) {
    for (const alias of aliases) {
      const score = Math.max(
        nameSimilarity(alias, service.nameAr),
        nameSimilarity(alias, service.nameEn),
      );
      if (score > bestScore) {
        best = service;
        bestScore = score;
      }
    }
  }
  return bestScore >= MIN_SCORE ? best : null;
}
