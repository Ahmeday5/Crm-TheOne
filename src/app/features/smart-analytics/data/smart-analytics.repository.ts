import { Observable } from 'rxjs';
import {
  ContactSlot,
  ContactTimeQuery,
  CustomerTickets,
  MonthKey,
  RepMonthlyPerformance,
  RepReview,
  RepReviewInput,
  SourceQualityQuery,
  SourceQualityRow,
} from '../models/smart-analytics.models';

/**
 * Persistence port for smart analytics.
 *
 * The store and UI depend only on this contract; the concrete adapter (mock
 * today, HTTP once `docs/api/smart-analytics.md` ships) is chosen in exactly
 * one place: `SMART_ANALYTICS_REPOSITORY` in
 * `smart-analytics-repository.provider.ts`.
 *
 * Contract every adapter honours:
 *   - Reads return raw facts only; scores, rates and rankings are computed
 *     on the client (`utils/`).
 *   - `monthlyPerformance()` and `saveReview()` are Admin-only and fail for
 *     anyone else (the backend answers `403`).
 *   - `saveReview()` is an upsert keyed by (repId, month).
 */
export abstract class SmartAnalyticsRepository {
  /** `true` when the adapter serves sample data — the page shows a "demo data" chip. */
  abstract readonly isDemo: boolean;

  abstract sourceQuality(query: SourceQualityQuery): Observable<SourceQualityRow[]>;
  abstract contactTimes(query: ContactTimeQuery): Observable<ContactSlot[]>;
  abstract customerTickets(): Observable<CustomerTickets[]>;
  abstract monthlyPerformance(month: MonthKey): Observable<RepMonthlyPerformance[]>;
  abstract saveReview(repId: string, month: MonthKey, input: RepReviewInput): Observable<RepReview>;
}
