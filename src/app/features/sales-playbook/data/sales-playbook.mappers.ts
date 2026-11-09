import {
  CallScript,
  CallScriptInput,
  Competitor,
  CompetitorInput,
  CompetitorMention,
  CompetitorMentionInput,
  Objection,
  ObjectionInput,
  PlaybookImportResult,
  PlaybookServiceRef,
  QuickReply,
  QuickReplyInput,
} from '../models/sales-playbook.models';
import {
  CallScriptDto,
  CallScriptRequest,
  CompetitorDto,
  CompetitorMentionDto,
  CompetitorMentionRequest,
  CompetitorRequest,
  LoadDefaultContentDto,
  ObjectionDto,
  ObjectionRequest,
  QuickReplyDto,
  QuickReplyRequest,
} from './sales-playbook.dto';

/**
 * DTO ⇄ domain translation — pure functions, the only code that knows both
 * the backend's field names and the UI's.
 */

const list = (items: readonly string[] | null | undefined): string[] =>
  (items ?? []).map((s) => s?.trim() ?? '').filter(Boolean);

const text = (value: string | null | undefined): string => value?.trim() ?? '';

const orNull = (value: string | null | undefined): string | null => value?.trim() || null;

/** The API only sends one service name; both languages show it until it sends more. */
function serviceRef(id: number | null, name: string | null): PlaybookServiceRef | null {
  if (id == null) return null;
  const label = name?.trim() || `#${id}`;
  return { id, nameAr: label, nameEn: label };
}

// ─────────── call scripts ───────────

export function toCallScript(dto: CallScriptDto): CallScript {
  return {
    id: String(dto.id),
    title: text(dto.title),
    service: serviceRef(dto.serviceId, dto.serviceName),
    opening: text(dto.opening),
    steps: list(dto.steps),
    questions: list(dto.keyQuestions),
    closing: text(dto.closing),
    isDefaultContent: !!dto.isDefaultContent,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? null,
  };
}

export function toCallScriptRequest(input: CallScriptInput): CallScriptRequest {
  return {
    title: input.title.trim(),
    serviceId: input.service?.id ?? null,
    opening: input.opening.trim(),
    steps: list(input.steps),
    keyQuestions: list(input.questions),
    closing: input.closing.trim(),
  };
}

// ─────────── objections ───────────

export function toObjection(dto: ObjectionDto): Objection {
  return {
    id: String(dto.id),
    category: text(dto.category),
    objection: text(dto.objection),
    answer: text(dto.response),
    isDefaultContent: !!dto.isDefaultContent,
  };
}

export function toObjectionRequest(input: ObjectionInput): ObjectionRequest {
  return {
    objection: input.objection.trim(),
    response: input.answer.trim(),
    category: input.category.trim(),
  };
}

// ─────────── competitors ───────────

export function toCompetitorMention(dto: CompetitorMentionDto): CompetitorMention {
  return {
    id: String(dto.id),
    customerId: dto.customerId,
    customerName: text(dto.customerName) || `#${dto.customerId}`,
    customerPhone: orNull(dto.customerPhone),
    note: orNull(dto.note),
    createdByName: orNull(dto.createdByName),
    createdAt: dto.createdAt,
  };
}

export function toCompetitor(dto: CompetitorDto): Competitor {
  const mentions = (dto.mentions ?? []).map(toCompetitorMention);
  return {
    id: String(dto.id),
    name: text(dto.name),
    website: text(dto.website),
    strengths: list(dto.strengths),
    weaknesses: list(dto.weaknesses),
    howToWin: text(dto.notes),
    mentionsCount: Math.max(dto.mentionsCount ?? 0, mentions.length),
    mentions,
  };
}

export function toCompetitorRequest(input: CompetitorInput): CompetitorRequest {
  return {
    name: input.name.trim(),
    website: orNull(input.website),
    strengths: list(input.strengths),
    weaknesses: list(input.weaknesses),
    notes: orNull(input.howToWin),
  };
}

export function toMentionRequest(input: CompetitorMentionInput): CompetitorMentionRequest {
  return { customerId: input.customerId, note: orNull(input.note) };
}

// ─────────── quick replies ───────────

export function toQuickReply(dto: QuickReplyDto): QuickReply {
  return {
    id: String(dto.id),
    title: text(dto.title),
    category: orNull(dto.category),
    text: dto.body ?? '',
    service: serviceRef(dto.serviceId, dto.serviceName),
    sortOrder: dto.sortOrder ?? 0,
    isDefaultContent: !!dto.isDefaultContent,
  };
}

export function toQuickReplyRequest(input: QuickReplyInput): QuickReplyRequest {
  return {
    title: input.title.trim(),
    body: input.text.trim(),
    category: orNull(input.category),
    serviceId: input.service?.id ?? null,
    sortOrder: input.sortOrder,
  };
}

// ─────────── ready-made content ───────────

export function toImportResult(dto: LoadDefaultContentDto): PlaybookImportResult {
  const scripts = dto.scripts ?? [];
  return {
    added: {
      scripts: dto.scriptsAdded ?? 0,
      objections: dto.objectionsAdded ?? 0,
      replies: dto.quickRepliesAdded ?? 0,
    },
    skipped: (dto.scriptsSkipped ?? 0) + (dto.objectionsSkipped ?? 0) + (dto.quickRepliesSkipped ?? 0),
    unlinkedScripts: scripts.filter((s) => s.added && s.serviceId == null).length,
  };
}
