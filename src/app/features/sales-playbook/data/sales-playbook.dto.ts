/**
 * Wire shapes of `api/SalesPlaybook` — exactly what the backend sends and
 * accepts (camelCase JSON). Nothing outside `data/` imports these; the
 * mappers translate them to and from the domain models.
 */

export interface CallScriptDto {
  id: number;
  title: string;
  serviceId: number | null;
  serviceName: string | null;
  opening: string;
  steps: string[] | null;
  keyQuestions: string[] | null;
  closing: string;
  isDefaultContent: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CallScriptRequest {
  title: string;
  serviceId: number | null;
  opening: string;
  steps: string[];
  keyQuestions: string[];
  closing: string;
}

export interface ObjectionDto {
  id: number;
  objection: string;
  response: string;
  category: string;
  isDefaultContent: boolean;
}

export interface ObjectionRequest {
  objection: string;
  response: string;
  category: string;
}

export interface ObjectionCategoryDto {
  category: string;
  count: number;
}

export interface CompetitorMentionDto {
  id: number;
  competitorId: number;
  competitorName: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CompetitorDto {
  id: number;
  name: string;
  website: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  notes: string | null;
  mentionsCount: number;
  /** `null` in the list endpoint; filled by `GET Competitors/{id}`. */
  mentions: CompetitorMentionDto[] | null;
}

export interface CompetitorRequest {
  name: string;
  website: string | null;
  strengths: string[];
  weaknesses: string[];
  notes: string | null;
}

export interface CompetitorMentionRequest {
  customerId: number;
  note: string | null;
}

export interface QuickReplyDto {
  id: number;
  title: string;
  body: string;
  category: string | null;
  serviceId: number | null;
  serviceName: string | null;
  sortOrder: number;
  isDefaultContent: boolean;
}

export interface QuickReplyRequest {
  title: string;
  body: string;
  category: string | null;
  serviceId: number | null;
  sortOrder: number;
}

export interface LoadDefaultContentDto {
  scriptsAdded: number;
  scriptsSkipped: number;
  objectionsAdded: number;
  objectionsSkipped: number;
  quickRepliesAdded: number;
  quickRepliesSkipped: number;
  scripts: Array<{
    program: string;
    added: boolean;
    serviceId: number | null;
    serviceName: string | null;
  }> | null;
}
