import { IndexedCommand, ScoredCommand } from '../models/command.models';

/**
 * Bilingual fuzzy search for the command palette. Pure — no Angular.
 *
 * Normalisation makes Arabic forgiving the way people actually type it:
 * hamza/alef variants, taa marbuta, alef maqsura, tatweel and diacritics are
 * folded, and a leading "ال" is ignored per word. Latin is lower-cased and
 * accent-stripped. Each command is indexed under its Arabic AND English
 * labels plus keywords, so "واتس", "whats" and "chat" all find WhatsApp
 * whatever the UI language is.
 */

const DIACRITICS = /[ً-ٰٟـ]/g; // harakat + superscript alef + tatweel

export function normalizeSearch(input: string): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w))
    .join(' ');
}

/** Are all chars of `needle` present in order inside `hay`? */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

/** Best score of one query token against one normalised string. */
function scoreToken(token: string, text: string): number {
  if (!token) return 0;
  if (text === token) return 100;
  if (text.startsWith(token)) return 80;
  if (text.split(' ').some((w) => w.startsWith(token))) return 65;
  if (text.includes(token)) return 45;
  if (token.length >= 3 && isSubsequence(token, text.replace(/\s/g, ''))) return 18;
  return 0;
}

/**
 * Every query token must match somewhere (AND), the final score is the sum of
 * each token's best match; ties keep the original (curated) order.
 */
export function searchCommands(index: IndexedCommand[], query: string, limit = 30): ScoredCommand[] {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (!tokens.length) return index.slice(0, limit).map((c) => ({ command: c.command, score: 0 }));

  const results: (ScoredCommand & { order: number })[] = [];
  index.forEach((entry, order) => {
    let total = 0;
    for (const token of tokens) {
      let best = 0;
      entry.haystack.forEach((text, i) => {
        // Labels (first two entries) outrank context/keywords slightly.
        const weight = i < 2 ? 1 : 0.85;
        best = Math.max(best, scoreToken(token, text) * weight);
      });
      if (best === 0) return;
      total += best;
    }
    results.push({ command: entry.command, score: total, order });
  });

  return results
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ command, score }) => ({ command, score }));
}
