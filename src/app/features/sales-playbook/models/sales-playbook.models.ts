/**
 * Sales playbook domain — call scripts, objection handling, competitor
 * intelligence and canned WhatsApp replies.
 *
 * Every record shares the same envelope (`PlaybookRecord`); the four
 * collections are addressed generically through `PlaybookKind` so the
 * repository, store and favourites never need a switch per type.
 */

export type PlaybookKind = 'scripts' | 'objections' | 'competitors' | 'replies';

export const PLAYBOOK_KINDS: ReadonlyArray<PlaybookKind> = [
  'scripts',
  'objections',
  'competitors',
  'replies',
];

export interface PlaybookRecord {
  id: string;
  createdAt: string;
  updatedAt: string | null;
}

// ─────────── call scripts ───────────

/** The service a script sells (snapshot of `Services management`). */
export interface PlaybookServiceRef {
  id: number;
  nameAr: string;
  nameEn: string;
}

export interface CallScriptInput {
  title: string;
  /** Linked service — `null` when the script is generic. */
  service: PlaybookServiceRef | null;
  /** One-line pitch shown on the card. */
  summary: string;
  opening: string;
  steps: string[];
  questions: string[];
  closing: string;
}

export interface CallScript extends PlaybookRecord, CallScriptInput {}

// ─────────── objections ───────────

export type ObjectionCategory =
  | 'price'
  | 'timing'
  | 'trust'
  | 'competitor'
  | 'need'
  | 'decisionMaker'
  | 'other';

export const OBJECTION_CATEGORIES: ReadonlyArray<ObjectionCategory> = [
  'price',
  'timing',
  'trust',
  'competitor',
  'need',
  'decisionMaker',
  'other',
];

export interface ObjectionInput {
  category: ObjectionCategory;
  /** What the customer says. */
  objection: string;
  /** The best answer — copied verbatim by reps. */
  answer: string;
  /** Optional coaching note for the rep (never sent to the customer). */
  tip: string;
}

export interface Objection extends PlaybookRecord, ObjectionInput {}

// ─────────── competitors ───────────

/** A customer who mentioned the competitor (snapshot from the customers dropdown). */
export interface CompetitorMention {
  customerId: number;
  name: string;
  company: string | null;
}

export interface CompetitorInput {
  name: string;
  website: string;
  strengths: string[];
  weaknesses: string[];
  /** How we win against them — the rep's talk track. */
  howToWin: string;
  mentions: CompetitorMention[];
}

export interface Competitor extends PlaybookRecord, CompetitorInput {}

// ─────────── quick replies ───────────

export type ReplyCategory = 'greeting' | 'info' | 'followUp' | 'closing' | 'support' | 'other';

export const REPLY_CATEGORIES: ReadonlyArray<ReplyCategory> = [
  'greeting',
  'info',
  'followUp',
  'closing',
  'support',
  'other',
];

export interface QuickReplyInput {
  title: string;
  category: ReplyCategory;
  /** WhatsApp text; may contain the `{name}` placeholder. */
  text: string;
}

export interface QuickReply extends PlaybookRecord, QuickReplyInput {}

// ─────────── generic addressing ───────────

export interface PlaybookEntityMap {
  scripts: CallScript;
  objections: Objection;
  competitors: Competitor;
  replies: QuickReply;
}

export interface PlaybookInputMap {
  scripts: CallScriptInput;
  objections: ObjectionInput;
  competitors: CompetitorInput;
  replies: QuickReplyInput;
}

export type PlaybookSnapshot = { [K in PlaybookKind]: PlaybookEntityMap[K][] };

export const EMPTY_SNAPSHOT: PlaybookSnapshot = {
  scripts: [],
  objections: [],
  competitors: [],
  replies: [],
};

// ─────────── ready-made content import ───────────

/** What the "load ready content" action sends (services already resolved). */
export interface PlaybookImportBundle {
  scripts: CallScriptInput[];
  objections: ObjectionInput[];
  replies: QuickReplyInput[];
}

export interface PlaybookImportResult {
  added: { scripts: number; objections: number; replies: number };
  /** Items already present (matched by normalised title / text). */
  skipped: number;
  /** Scripts that found no similar service in Services management. */
  unlinkedScripts: number;
}
