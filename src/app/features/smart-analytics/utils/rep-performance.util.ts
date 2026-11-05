import { RepMonthlyPerformance } from '../models/smart-analytics.models';
import { percent, sum } from './analytics-math.util';

/** Monthly performance — pure derived figures for the admin review table. */

export interface RepPerformanceView extends RepMonthlyPerformance {
  /** answered ÷ calls, 0–100. */
  answerRate: number;
  /** buyers ÷ answered calls, 0–100. */
  closeRate: number;
  /** Calls relative to the busiest rep, 0–1 (bar length). */
  relativeCalls: number;
  isTopSeller: boolean;
}

export interface TeamTotals {
  calls: number;
  answeredCalls: number;
  buyers: number;
  answerRate: number;
  closeRate: number;
  reviewed: number;
  reps: number;
}

export function toPerformanceViews(rows: ReadonlyArray<RepMonthlyPerformance>): RepPerformanceView[] {
  const maxCalls = Math.max(0, ...rows.map((r) => r.calls));
  const maxBuyers = Math.max(0, ...rows.map((r) => r.buyers));
  return rows.map((r) => ({
    ...r,
    answerRate: percent(r.answeredCalls, r.calls, 1),
    closeRate: percent(r.buyers, r.answeredCalls, 1),
    relativeCalls: maxCalls ? r.calls / maxCalls : 0,
    isTopSeller: maxBuyers > 0 && r.buyers === maxBuyers,
  }));
}

export function teamTotals(rows: ReadonlyArray<RepMonthlyPerformance>): TeamTotals {
  const calls = sum(rows, (r) => r.calls);
  const answeredCalls = sum(rows, (r) => r.answeredCalls);
  const buyers = sum(rows, (r) => r.buyers);
  return {
    calls,
    answeredCalls,
    buyers,
    answerRate: percent(answeredCalls, calls, 1),
    closeRate: percent(buyers, answeredCalls, 1),
    reviewed: rows.filter((r) => !!r.review).length,
    reps: rows.length,
  };
}

/** Best sellers first; ties broken by answer rate, then name. */
export function compareReps(a: RepPerformanceView, b: RepPerformanceView): number {
  return b.buyers - a.buyers || b.answerRate - a.answerRate || a.repName.localeCompare(b.repName, 'ar');
}

/** A rating is an integer star count, 1–5. */
export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}
