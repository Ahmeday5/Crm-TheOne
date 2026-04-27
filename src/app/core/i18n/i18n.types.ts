/**
 * Strict typing for translation dictionaries.
 *
 *  - `TranslationLeaf`     leaf node: a string value
 *  - `TranslationDict`     a tree of leaves and nested dicts
 *  - `TranslationFile<K>`  a single component bundle keyed by `K`
 *
 *  Keys are dotted paths in templates: `'header.profile'`, `'auth.login.title'`, etc.
 *  AR and EN bundles must share the same shape (TypeScript enforces this through
 *  `Translations` below).
 */

export type TranslationLeaf = string;

export interface TranslationDict {
  [key: string]: TranslationLeaf | TranslationDict;
}

/**
 * Per-component file shape: a namespace key (e.g. `header`) at the top, then
 * the dictionary underneath.
 */
export type TranslationFile<K extends string = string> = Record<K, TranslationDict>;

/** Combined dictionary used at runtime. */
export type Translations = TranslationDict;
