import { PlaybookKind, PlaybookServiceRef } from '../models/sales-playbook.models';
import { normalizePlaceholders } from '../utils/playbook.util';

/**
 * Reader for the playbook content saved in this browser before the backend
 * existed (the old `localStorage` adapter). Used only by the one-time
 * "move local content to the server" step — once that succeeds the data is
 * archived (not deleted) under `ARCHIVE_KEY`, so nothing is ever lost.
 *
 * Old records are parsed defensively: anything malformed is skipped rather
 * than breaking the page.
 */

const LEGACY_KEY = 'crm.salesPlaybook.mock.v1';
const ARCHIVE_KEY = 'crm.salesPlaybook.mock.v1.migrated';

/** Old enum keys → the Arabic labels the old UI displayed (the content is Arabic). */
const LEGACY_OBJECTION_CATEGORY: Record<string, string> = {
  price: 'السعر',
  timing: 'التوقيت',
  trust: 'الثقة',
  competitor: 'المنافس',
  need: 'الاحتياج',
  decisionMaker: 'صاحب القرار',
  other: 'أخرى',
};

const LEGACY_REPLY_CATEGORY: Record<string, string> = {
  greeting: 'ترحيب',
  info: 'معلومات',
  followUp: 'متابعة',
  closing: 'إغلاق وحجز',
  support: 'دعم',
  other: 'أخرى',
};

export interface LegacyScript {
  legacyId: string;
  title: string;
  service: PlaybookServiceRef | null;
  opening: string;
  steps: string[];
  questions: string[];
  closing: string;
}

export interface LegacyObjection {
  legacyId: string;
  category: string;
  objection: string;
  answer: string;
}

export interface LegacyCompetitor {
  legacyId: string;
  name: string;
  website: string;
  strengths: string[];
  weaknesses: string[];
  howToWin: string;
  mentionCustomerIds: number[];
}

export interface LegacyReply {
  legacyId: string;
  title: string;
  category: string | null;
  text: string;
}

export interface LegacyPlaybook {
  scripts: LegacyScript[];
  objections: LegacyObjection[];
  competitors: LegacyCompetitor[];
  replies: LegacyReply[];
}

export function legacyItemCount(p: LegacyPlaybook): number {
  return p.scripts.length + p.objections.length + p.competitors.length + p.replies.length;
}

/** `null` when this browser has no (non-empty) legacy content. */
export function readLegacyPlaybook(): LegacyPlaybook | null {
  let raw: Record<string, unknown> | null;
  try {
    raw = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;

  const playbook: LegacyPlaybook = {
    scripts: rows(raw, 'scripts').map(toScript).filter(isSome),
    objections: rows(raw, 'objections').map(toObjection).filter(isSome),
    competitors: rows(raw, 'competitors').map(toCompetitor).filter(isSome),
    replies: rows(raw, 'replies').map(toReply).filter(isSome),
  };
  return legacyItemCount(playbook) ? playbook : null;
}

/** Moves the legacy content aside so it's never offered again (kept for recovery). */
export function archiveLegacyPlaybook(): void {
  try {
    const value = localStorage.getItem(LEGACY_KEY);
    if (value === null) return;
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify({ archivedAt: new Date().toISOString(), data: JSON.parse(value) }));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage blocked — the dedupe step makes a repeat run harmless anyway */
  }
}

// ─────────── parsing ───────────

type Raw = Record<string, unknown>;

function rows(raw: Raw, kind: PlaybookKind): Raw[] {
  const value = raw[kind];
  return Array.isArray(value) ? value.filter((r): r is Raw => !!r && typeof r === 'object') : [];
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const id = (r: Raw): string => str(r['id']) || String(r['id'] ?? '');
const isSome = <T>(v: T | null): v is T => v !== null;

function toService(v: unknown): PlaybookServiceRef | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Raw;
  const sid = Number(s['id']);
  return Number.isFinite(sid) && sid > 0 ? { id: sid, nameAr: str(s['nameAr']), nameEn: str(s['nameEn']) } : null;
}

function toScript(r: Raw): LegacyScript | null {
  const title = str(r['title']);
  const opening = str(r['opening']);
  const closing = str(r['closing']);
  if (!title || !opening || !closing) return null;
  return {
    legacyId: id(r),
    title,
    service: toService(r['service']),
    opening,
    steps: strList(r['steps']),
    questions: strList(r['questions']),
    closing,
  };
}

function toObjection(r: Raw): LegacyObjection | null {
  const objection = str(r['objection']);
  const answer = str(r['answer']);
  if (!objection || !answer) return null;
  const key = str(r['category']);
  return {
    legacyId: id(r),
    category: LEGACY_OBJECTION_CATEGORY[key] ?? (key || LEGACY_OBJECTION_CATEGORY['other']),
    objection,
    answer,
  };
}

function toCompetitor(r: Raw): LegacyCompetitor | null {
  const name = str(r['name']);
  if (!name) return null;
  const mentions = Array.isArray(r['mentions']) ? (r['mentions'] as Raw[]) : [];
  return {
    legacyId: id(r),
    name,
    website: str(r['website']),
    strengths: strList(r['strengths']),
    weaknesses: strList(r['weaknesses']),
    howToWin: str(r['howToWin']),
    mentionCustomerIds: [
      ...new Set(mentions.map((m) => Number(m?.['customerId'])).filter((n) => Number.isFinite(n) && n > 0)),
    ],
  };
}

function toReply(r: Raw): LegacyReply | null {
  const title = str(r['title']);
  const text = str(r['text']);
  if (!title || !text) return null;
  const key = str(r['category']);
  return {
    legacyId: id(r),
    title,
    category: LEGACY_REPLY_CATEGORY[key] ?? (key || null),
    text: normalizePlaceholders(text),
  };
}
