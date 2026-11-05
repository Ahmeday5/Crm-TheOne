import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  AnalyticsRange,
  ContactSlot,
  ContactTimeQuery,
  CustomerTickets,
  HealthTicket,
  MonthKey,
  REVIEW_NOTE_MAX,
  RepMonthlyPerformance,
  RepReview,
  RepReviewInput,
  SourceQualityQuery,
  SourceQualityRow,
  WeekDay,
} from '../models/smart-analytics.models';
import { WEEK_DAYS, WORK_HOURS } from '../utils/contact-time.util';
import { cairoMonth, isMonthKey, monthProgress } from '../utils/month.util';
import { isValidRating } from '../utils/rep-performance.util';
import {
  CAMPAIGN_SEEDS,
  CUSTOMER_NAMES,
  DAY_PROFILE,
  HEALTH_PROFILES,
  HOURLY_ANSWER_RATE,
  HOURLY_CALL_VOLUME,
  PHONE_PREFIXES,
  REP_SEEDS,
  REVIEW_NOTES,
  SOURCE_SEEDS,
} from './mock-smart-analytics.data';
import { SeededRandom } from './seeded-random';
import { SmartAnalyticsRepository } from './smart-analytics.repository';

const STORAGE_KEY = 'crm.smartAnalytics.reviews.v1';
/** Small artificial latency so loading states are exercised like the real API. */
const LATENCY_MS = 200;
const DAY_MS = 86_400_000;

const RANGE_MONTHS: Readonly<Record<AnalyticsRange, number>> = { '30d': 1, '90d': 3, '12m': 12 };

/** Persisted admin reviews: `${month}:${repId}` → review. */
type StoredReviews = Record<string, RepReview>;

/**
 * TEMPORARY adapter until the `/SmartAnalytics` endpoints exist.
 *
 * Every number comes from a seeded PRNG keyed by the query (range,
 * dimension, month…), so the data is realistic, stable across reloads and
 * identical for everyone. Admin reviews persist in `localStorage`. Mirrors
 * the server rules (Admin-only performance, validation) so swapping in
 * `HttpSmartAnalyticsRepository` needs no UI change.
 */
@Injectable({ providedIn: 'root' })
export class MockSmartAnalyticsRepository extends SmartAnalyticsRepository {
  private readonly auth = inject(AuthService);

  readonly isDemo = true;

  sourceQuality(query: SourceQualityQuery): Observable<SourceQualityRow[]> {
    return this.respond(() => {
      const seeds = query.dimension === 'campaign' ? CAMPAIGN_SEEDS : SOURCE_SEEDS;
      const months = RANGE_MONTHS[query.range];
      return seeds.map((seed) => {
        const rnd = new SeededRandom(`sources:${query.range}:${seed.id}`);
        const customers = Math.max(1, Math.round(seed.monthly * months * rnd.range(0.82, 1.18)));
        const buyers = rnd.successes(customers, seed.conversion * rnd.range(0.85, 1.15));
        return {
          id: seed.id,
          name: seed.name,
          dimension: query.dimension,
          channel: seed.channel,
          customers,
          buyers,
        };
      });
    });
  }

  contactTimes(query: ContactTimeQuery): Observable<ContactSlot[]> {
    return this.respond(() => {
      const months = RANGE_MONTHS[query.range];
      const slots: ContactSlot[] = [];
      for (const day of WEEK_DAYS) {
        for (const hour of WORK_HOURS) {
          const rnd = new SeededRandom(`contact:${query.range}:${day}:${hour}`);
          const calls = Math.round(
            HOURLY_CALL_VOLUME[hour] * DAY_PROFILE[day].volume * fridayVolume(day, hour) * months * rnd.range(0.8, 1.2),
          );
          const p = clampRate(
            HOURLY_ANSWER_RATE[hour] + DAY_PROFILE[day].shift + dayHourShift(day, hour) + rnd.range(-0.04, 0.04),
          );
          slots.push({ day, hour, calls, answered: rnd.successes(calls, p) });
        }
      }
      return slots;
    });
  }

  customerTickets(): Observable<CustomerTickets[]> {
    return this.respond(() => {
      // Anchored to the start of today so ticket ages stay put during the day.
      const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
      return CUSTOMER_NAMES.map((name, i) => {
        const id = `cus-${1000 + i * 7}`;
        const rnd = new SeededRandom(`health:${id}`);
        const profile = rnd.weighted(HEALTH_PROFILES.map((p) => [p, p.weight] as const));
        const tickets: HealthTicket[] = [];
        const closed = rnd.int(...profile.closed);
        const open = rnd.int(...profile.open);
        for (let t = 0; t < closed + open; t++) {
          const isOpen = t >= closed;
          const daysAgo = isOpen ? rnd.int(...profile.openAge) : rnd.int(5, 120);
          tickets.push({
            id: `${id}-t${t + 1}`,
            priority: rnd.weighted(profile.priorities),
            isOpen,
            openedAt: new Date(today - daysAgo * DAY_MS - rnd.int(1, 10) * 3_600_000).toISOString(),
          });
        }
        return {
          customerId: id,
          customerName: name,
          phone: `${rnd.pick(PHONE_PREFIXES)}${String(rnd.int(0, 99_999_999)).padStart(8, '0')}`,
          ownerName: rnd.pick(REP_SEEDS).name,
          tickets,
        };
      });
    });
  }

  monthlyPerformance(month: MonthKey): Observable<RepMonthlyPerformance[]> {
    return this.respond(() => {
      this.assertAdmin();
      if (!isMonthKey(month) || month > cairoMonth()) throw { message: 'Invalid month.' };
      const progress = monthProgress(month);
      const reviews = this.readReviews();
      return REP_SEEDS.map((rep) => {
        const rnd = new SeededRandom(`performance:${month}:${rep.id}`);
        const calls = Math.round(rep.calls * progress * rnd.range(0.82, 1.15));
        const answeredCalls = rnd.successes(calls, clampRate(rep.answer + rnd.range(-0.06, 0.06)));
        const buyers = rnd.successes(answeredCalls, clampRate(rep.close + rnd.range(-0.03, 0.03)));
        return {
          repId: rep.id,
          repName: rep.name,
          imageUrl: null,
          calls,
          answeredCalls,
          buyers,
          review: reviews[reviewKey(month, rep.id)] ?? this.seededReview(month, rep.id, answeredCalls, buyers),
        };
      });
    });
  }

  saveReview(repId: string, month: MonthKey, input: RepReviewInput): Observable<RepReview> {
    return this.respond(() => {
      this.assertAdmin();
      const note = (input.note ?? '').trim();
      if (!isValidRating(input.rating)) throw { message: 'Rating must be 1–5 stars.' };
      if (note.length > REVIEW_NOTE_MAX) throw { message: `Note is limited to ${REVIEW_NOTE_MAX} characters.` };
      if (!isMonthKey(month) || month > cairoMonth()) throw { message: 'Invalid month.' };
      if (!REP_SEEDS.some((r) => r.id === repId)) throw { message: 'Sales rep not found.' };

      const user = this.auth.currentUser();
      const review: RepReview = {
        repId,
        month,
        rating: input.rating,
        note,
        reviewedAt: new Date().toISOString(),
        reviewedBy: { id: user?.userId ?? '', name: user?.fullName || user?.email || '' },
      };
      this.writeReviews({ ...this.readReviews(), [reviewKey(month, repId)]: review });
      return review;
    });
  }

  // ─────────── internals ───────────

  /** Runs `build` lazily per subscription; a thrown `{ message }` becomes an error. */
  private respond<T>(build: () => T): Observable<T> {
    return defer(() => {
      try {
        return of(build());
      } catch (err) {
        return throwError(() => err);
      }
    }).pipe(delay(LATENCY_MS));
  }

  private assertAdmin(): void {
    if (this.auth.currentRole() !== 'Admin') {
      throw { message: 'Only admins can view or rate monthly performance.', statusCode: 403 };
    }
  }

  /** Past months come pre-reviewed (mostly) so the page looks lived-in. */
  private seededReview(month: MonthKey, repId: string, answered: number, buyers: number): RepReview | null {
    if (month >= cairoMonth()) return null;
    const rnd = new SeededRandom(`review:${month}:${repId}`);
    if (!rnd.chance(0.8)) return null;
    const close = answered ? buyers / answered : 0;
    const rating = Math.max(1, Math.min(5, Math.round(close * 25 + rnd.range(-0.6, 0.6))));
    const [y, m] = month.split('-').map(Number);
    return {
      repId,
      month,
      rating,
      note: rnd.pick(REVIEW_NOTES[rating]),
      reviewedAt: new Date(Date.UTC(y, m, rnd.int(1, 4), 9, 30)).toISOString(),
      reviewedBy: { id: 'seed-admin', name: 'الإدارة' },
    };
  }

  private readReviews(): StoredReviews {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as StoredReviews) : {};
    } catch {
      return {};
    }
  }

  private writeReviews(rows: StoredReviews): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* storage full / blocked — the review lives until the next reload */
    }
  }
}

function reviewKey(month: MonthKey, repId: string): string {
  return `${month}:${repId}`;
}

function clampRate(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}

/** Friday: almost nobody is called before the noon prayer. */
function fridayVolume(day: WeekDay, hour: number): number {
  if (day !== 6) return 1;
  return hour < 12 ? 0.35 : hour < 14 ? 0.5 : 1.3;
}

/** Local patterns on top of the hour/day baselines. */
function dayHourShift(day: WeekDay, hour: number): number {
  if (day === 6) return hour < 14 ? -0.22 : 0.08; // Friday: prayer + family lunch, then relaxed evening
  if (day === 5 && hour >= 18) return 0.07; // Thursday evening, weekend mood
  if (day === 0 && hour <= 10) return -0.05; // Saturday morning starts slow
  return 0;
}
