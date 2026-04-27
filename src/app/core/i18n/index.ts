import ar from './ar';
import en from './en';
import { Lang } from '../services/language.service';
import { Translations } from './i18n.types';

export type { TranslationDict, TranslationFile, Translations } from './i18n.types';

/** Resolves a dotted key against a translation tree.
 *  Returns the original key if missing — easy to spot in the UI. */
export function resolveKey(dict: Translations, key: string): string {
  if (!key) return '';
  const parts = key.split('.');
  let node: unknown = dict;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in (node as object)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof node === 'string' ? node : key;
}

export const TRANSLATIONS: Record<Lang, Translations> = { ar, en };
