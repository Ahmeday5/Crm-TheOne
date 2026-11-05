import { UserRole } from '../../../core/models/auth.model';

/*
 * Smart analytics — domain models.
 *
 * Everything the backend sends is *raw facts* (counts, tickets, calls);
 * every derived number (conversion, answer rate, health score, ranking) is
 * computed on the client by the pure functions in `utils/`, so the formula
 * lives in exactly one place and is unit-testable without Angular.
 */

// ─────────── page structure ───────────

export type AnalyticsSection = 'sources' | 'timing' | 'health' | 'performance';

/** Who may open each section. The route itself admits the union of these. */
export const SECTION_ACCESS: Readonly<Record<AnalyticsSection, ReadonlyArray<UserRole>>> = {
  sources: ['Admin', 'Marketing', 'Sales'],
  timing: ['Admin', 'Marketing', 'Sales'],
  health: ['Admin', 'Marketing', 'Sales'],
  performance: ['Admin'],
};

export const ANALYTICS_SECTIONS: ReadonlyArray<AnalyticsSection> = [
  'sources',
  'timing',
  'health',
  'performance',
];

/** Rolling look-back window for the sources and timing sections. */
export type AnalyticsRange = '30d' | '90d' | '12m';

export const ANALYTICS_RANGES: ReadonlyArray<AnalyticsRange> = ['30d', '90d', '12m'];

// ─────────── 1. source quality ───────────

export type SourceDimension = 'source' | 'campaign';

/** Acquisition channel — drives the row icon and the localized source label. */
export type SourceChannel =
  | 'facebook'
  | 'instagram'
  | 'google'
  | 'tiktok'
  | 'whatsapp'
  | 'website'
  | 'referral'
  | 'walkIn'
  | 'other';

export interface SourceQualityRow {
  id: string;
  /** Display name as stored on the backend (campaign names are user-entered). */
  name: string;
  dimension: SourceDimension;
  channel: SourceChannel;
  /** Customers who entered the CRM through this source within the range. */
  customers: number;
  /** Of those, customers who bought at least once. */
  buyers: number;
}

export interface SourceQualityQuery {
  dimension: SourceDimension;
  range: AnalyticsRange;
}

// ─────────── 2. best time to contact ───────────

/**
 * Day of the Egyptian work week: `0` = Saturday … `6` = Friday.
 * (Not JS `Date#getDay()` — see `toWeekDay()` in the utils.)
 */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Outbound calls placed in one (day, hour) bucket, Cairo time. */
export interface ContactSlot {
  day: WeekDay;
  /** Hour of day, 0–23 — the bucket covers `hour:00` to `hour:59`. */
  hour: number;
  calls: number;
  answered: number;
}

export interface ContactTimeQuery {
  range: AnalyticsRange;
}

// ─────────── 3. customer health ───────────

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface HealthTicket {
  id: string;
  priority: TicketPriority;
  isOpen: boolean;
  /** UTC ISO-8601. */
  openedAt: string;
}

/** One customer and their recent support history (last 90 days + anything still open). */
export interface CustomerTickets {
  customerId: string;
  customerName: string;
  phone: string | null;
  /** Account owner (sales rep), if any. */
  ownerName: string | null;
  tickets: HealthTicket[];
}

export type HealthClass = 'healthy' | 'atRisk' | 'critical';

export const HEALTH_CLASSES: ReadonlyArray<HealthClass> = ['healthy', 'atRisk', 'critical'];

export type HealthFactor = 'volume' | 'open' | 'priority' | 'age';

/** One reason the score dropped — `points` is the (positive) amount deducted. */
export interface HealthPenalty {
  factor: HealthFactor;
  points: number;
  /** Max this factor can ever deduct (for the breakdown bar). */
  cap: number;
  /** The fact behind it (ticket count, or days for `age`). */
  count: number;
}

export interface CustomerHealth {
  customerId: string;
  customerName: string;
  phone: string | null;
  ownerName: string | null;
  score: number;
  healthClass: HealthClass;
  /** Non-zero deductions, biggest first. */
  penalties: HealthPenalty[];
  totalTickets: number;
  openTickets: number;
  /** Age in days of the oldest open ticket, `0` when none is open. */
  oldestOpenDays: number;
}

// ─────────── 4. monthly performance (Admin) ───────────

/** `YYYY-MM`, Cairo calendar. */
export type MonthKey = string;

export interface ReviewAuthor {
  id: string;
  name: string;
}

export interface RepReview {
  repId: string;
  month: MonthKey;
  /** 1–5. */
  rating: number;
  note: string;
  /** UTC ISO-8601. */
  reviewedAt: string;
  reviewedBy: ReviewAuthor;
}

export interface RepReviewInput {
  rating: number;
  note: string;
}

export const REVIEW_NOTE_MAX = 500;

export interface RepMonthlyPerformance {
  repId: string;
  repName: string;
  imageUrl: string | null;
  calls: number;
  answeredCalls: number;
  /** Customers this rep closed (first purchase) during the month. */
  buyers: number;
  review: RepReview | null;
}
