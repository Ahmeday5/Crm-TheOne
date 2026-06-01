/**
 * Models for the `Articles/*` (knowledge-base) endpoints.
 *
 * Enum handling mirrors the backend's `DescriptionEnumConverter`:
 *   - Reads return the enum NAME in `type` / `accessLevel` / `status`
 *     (e.g. `"Guide"`) plus the localized Arabic description in `*Name`.
 *   - Writes (create form-data, update body, the list `Type` filter) accept the
 *     Arabic DESCRIPTION string (e.g. `"دليل"`).
 *
 * So every option below carries both: `name` (what the API returns) and `api`
 * (the Arabic description the API expects on input). Display uses `labelKey`.
 */

export type ArticleTypeName =
  | 'Guide'
  | 'Procedure'
  | 'ProblemSolving'
  | 'BestPractices'
  | 'TechnicalReference';

export type ArticleStatusName = 'Draft' | 'Published';

export type ArticleAccessLevelName =
  | 'Public'
  | 'DevelopersOnly'
  | 'SupportOnly'
  | 'ManagementOnly'
  | 'SalesOnly';

/** Article category links to either a project or a customer. */
export type ArticleCategorySource = 'Project' | 'Customer';

/**
 * One option for an enum `<select>`.
 *   - `name` — enum name the API returns (used to match a read value).
 *   - `api`  — Arabic description the API accepts on input.
 *   - `labelKey` — i18n key for the visible label.
 */
export interface ArticleEnumOption<T extends string> {
  name: T;
  api: string;
  labelKey: string;
}

export const ARTICLE_TYPES: ReadonlyArray<ArticleEnumOption<ArticleTypeName>> = [
  { name: 'Guide', api: 'دليل', labelKey: 'kb.types.Guide' },
  { name: 'Procedure', api: 'إجراء', labelKey: 'kb.types.Procedure' },
  { name: 'ProblemSolving', api: 'حل مشكلة', labelKey: 'kb.types.ProblemSolving' },
  { name: 'BestPractices', api: 'أفضل الممارسات', labelKey: 'kb.types.BestPractices' },
  { name: 'TechnicalReference', api: 'مرجع تقني', labelKey: 'kb.types.TechnicalReference' },
];

export const ARTICLE_STATUSES: ReadonlyArray<ArticleEnumOption<ArticleStatusName>> = [
  { name: 'Draft', api: 'مسودة', labelKey: 'kb.statuses.Draft' },
  { name: 'Published', api: 'منشورة', labelKey: 'kb.statuses.Published' },
];

export const ARTICLE_ACCESS_LEVELS: ReadonlyArray<
  ArticleEnumOption<ArticleAccessLevelName>
> = [
  { name: 'Public', api: 'عام - الجميع', labelKey: 'kb.access.Public' },
  { name: 'DevelopersOnly', api: 'المطورين فقط', labelKey: 'kb.access.DevelopersOnly' },
  { name: 'SupportOnly', api: 'الدعم الفني فقط', labelKey: 'kb.access.SupportOnly' },
  { name: 'ManagementOnly', api: 'الإدارة فقط', labelKey: 'kb.access.ManagementOnly' },
  { name: 'SalesOnly', api: 'السيلز فقط', labelKey: 'kb.access.SalesOnly' },
];

/** Subtle-badge classes per article status. */
export function articleStatusBadgeClass(status: ArticleStatusName | string): string {
  return status === 'Published'
    ? 'bg-success-subtle text-success'
    : 'bg-secondary-subtle text-secondary';
}

/** Subtle-badge classes per article type. */
export function articleTypeBadgeClass(type: ArticleTypeName | string): string {
  switch (type) {
    case 'Guide':
      return 'bg-primary-subtle text-primary';
    case 'Procedure':
      return 'bg-info-subtle text-info';
    case 'ProblemSolving':
      return 'bg-warning-subtle text-warning';
    case 'BestPractices':
      return 'bg-success-subtle text-success';
    case 'TechnicalReference':
      return 'bg-purple-subtle text-purple';
    default:
      return 'bg-secondary-subtle text-secondary';
  }
}

/** An uploaded file attached to an article. */
export interface ArticleAttachment {
  fileUrl: string;
  fileName: string;
}

/** An article as returned by the list + by-id reads. */
export interface Article {
  id: number;
  title: string;
  type: ArticleTypeName;
  typeName: string;
  accessLevel: ArticleAccessLevelName;
  accessLevelName: string;
  categoryType: ArticleCategorySource | string | null;
  categoryId: number | null;
  summary: string | null;
  content: string | null;
  steps: string | null;
  keywords: string | null;
  status: ArticleStatusName;
  statusName: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  attachments: ArticleAttachment[];
}

/** Query params for `GET /Articles/GetArticles`. `Type` is the Arabic description. */
export interface ArticleListQuery {
  PageIndex?: number;
  PageSize?: number;
  Search?: string;
  Type?: string;
}

/**
 * Body for `PUT /Articles/UpdateArticle/{id}` (JSON).
 * `type` / `accessLevel` / `status` are the Arabic description strings.
 */
export interface UpdateArticleBody {
  title: string;
  type: string;
  accessLevel: string;
  categoryId: number | null;
  summary: string;
  content: string;
  steps: string;
  keywords: string;
  status: string;
}

/** An item from `ProjectOptions` / `CustomerOptions` (article category source). */
export interface ArticleCategoryOption {
  id: number;
  name: string;
  type: ArticleCategorySource | string;
}

/** Max number of attachments accepted on create. */
export const ARTICLE_MAX_ATTACHMENTS = 5;
