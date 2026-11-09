/**
 * Sales playbook domain — call scripts, objection handling, competitor
 * intelligence and canned WhatsApp replies.
 *
 * These are the shapes the UI works with. The backend's DTOs differ in
 * naming and structure; `data/sales-playbook.mappers.ts` is the only place
 * that knows both, so an API rename never ripples into components.
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
  /** Server id, stringified so it can key favourites and DOM ids. */
  id: string;
}

/** A service from "Services management" that content can be linked to. */
export interface PlaybookServiceRef {
  id: number;
  nameAr: string;
  nameEn: string;
}

// ─────────── call scripts ───────────

export interface CallScriptInput {
  title: string;
  /** `null` = generic script (not tied to a service). */
  service: PlaybookServiceRef | null;
  opening: string;
  steps: string[];
  questions: string[];
  closing: string;
}

export interface CallScript extends PlaybookRecord, CallScriptInput {
  /** Came from "load ready content". */
  isDefaultContent: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// ─────────── objections ───────────

export interface ObjectionInput {
  /** Free text ("السعر", "التأجيل"…) — the list comes from the data, never hard-coded. */
  category: string;
  /** What the customer says. */
  objection: string;
  /** The best answer — copied verbatim by reps. */
  answer: string;
}

export interface Objection extends PlaybookRecord, ObjectionInput {
  isDefaultContent: boolean;
}

// ─────────── competitors ───────────

export interface CompetitorInput {
  name: string;
  website: string;
  strengths: string[];
  /** Their weak spots — where we beat them. */
  weaknesses: string[];
  /** How we win against them — the rep's talk track. */
  howToWin: string;
}

/** A customer who brought the competitor up. */
export interface CompetitorMention {
  id: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface Competitor extends PlaybookRecord, CompetitorInput {
  mentionsCount: number;
  /** Newest first. */
  mentions: CompetitorMention[];
}

export interface CompetitorMentionInput {
  customerId: number;
  note: string;
}

// ─────────── quick replies ───────────

export interface QuickReplyInput {
  title: string;
  /** Free text ("ترحيب", "متابعة"…); `null` = uncategorised. */
  category: string | null;
  /** WhatsApp text; may contain `{{customerName}}` / `{{agentName}}`. */
  text: string;
  service: PlaybookServiceRef | null;
  /** Position in the list (ascending). */
  sortOrder: number;
}

export interface QuickReply extends PlaybookRecord, QuickReplyInput {
  isDefaultContent: boolean;
}

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

// ─────────── ready-made content ───────────

/** Outcome of `LoadDefaultContent` (idempotent — re-running adds nothing). */
export interface PlaybookImportResult {
  added: { scripts: number; objections: number; replies: number };
  /** Items that already existed and were skipped. */
  skipped: number;
  /** Ready-made scripts that found no matching service (saved as generic). */
  unlinkedScripts: number;
}
