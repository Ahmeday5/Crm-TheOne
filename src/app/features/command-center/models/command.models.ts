import { UserRole } from '../../../core/models/auth.model';

export type CommandGroup = 'recent' | 'pages' | 'actions';

/**
 * Anything the user can reach from Ctrl+K: a page (navigates) or an action
 * (runs code). Labels are i18n keys so search can match BOTH languages.
 */
export interface AppCommand {
  id: string;
  group: Exclude<CommandGroup, 'recent'>;
  labelKey: string;
  /** Secondary line, e.g. the sidebar group a page belongs to. */
  contextKey?: string;
  icon: string;
  /** Extra search terms (synonyms, Franco-Arabic, abbreviations). */
  keywords?: string[];
  roles?: UserRole[];
  /** Display-only key hint, e.g. ['G', 'P']. */
  shortcut?: string[];
  /** Page commands. */
  path?: string;
  queryParams?: Record<string, string>;
  /** Action commands. */
  run?: () => void | Promise<unknown>;
}

/** A command plus everything search needs, pre-normalised once. */
export interface IndexedCommand {
  command: AppCommand;
  /** Normalised searchable strings (AR label, EN label, context, keywords). */
  haystack: string[];
}

export interface ScoredCommand {
  command: AppCommand;
  score: number;
}

/** One keyboard shortcut — single key (`n`) or a sequence (`g` then `p`). */
export interface ShortcutDef {
  id: string;
  keys: string[];
  labelKey: string;
  /** Command id to execute. */
  commandId: string;
}
