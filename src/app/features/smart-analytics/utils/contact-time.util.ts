import { ContactSlot, WeekDay } from '../models/smart-analytics.models';
import { percent, round, sum, wilsonLowerBound } from './analytics-math.util';

/**
 * Best-time-to-contact — pure heatmap and ranking logic.
 *
 * The Egyptian work week starts on Saturday, so day `0` is Saturday and
 * `6` is Friday. Hours are Cairo-local.
 */

/** Saturday → Friday. */
export const WEEK_DAYS: ReadonlyArray<WeekDay> = [0, 1, 2, 3, 4, 5, 6];

/** Working-hours window shown on the heatmap: buckets 9:00 … 20:59 (ends 21:00). */
export const WORK_HOUR_START = 9;
export const WORK_HOUR_END = 21;
export const WORK_HOURS: ReadonlyArray<number> = Array.from(
  { length: WORK_HOUR_END - WORK_HOUR_START },
  (_, i) => WORK_HOUR_START + i,
);

/** A bucket with fewer calls than this is shown as "not enough data" and never ranked. */
export const MIN_SLOT_CALLS = 8;

/**
 * Answer-rate thresholds (percent) for heat levels 1…5 — absolute, not
 * relative to the data, so the legend means the same thing every period.
 */
export const HEAT_THRESHOLDS: ReadonlyArray<number> = [30, 45, 60, 75];

/** `-1` = not enough data; `0…4` = answer-rate band (low → high). */
export type HeatLevel = -1 | 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  day: WeekDay;
  hour: number;
  calls: number;
  answered: number;
  /** 0–100, one decimal. */
  rate: number;
  level: HeatLevel;
  /** 1–3 when this cell is one of the recommended times, else 0. */
  rank: number;
}

export interface RankedSlot extends ContactSlot {
  rate: number;
  rank: number;
}

export interface ContactSummary {
  totalCalls: number;
  totalAnswered: number;
  overallRate: number;
  bestDay: { day: WeekDay; rate: number } | null;
  bestHour: { hour: number; rate: number } | null;
}

/** JS `Date#getDay()` (0 = Sunday) → Egyptian week index (0 = Saturday). */
export function toWeekDay(jsDay: number): WeekDay {
  return ((jsDay + 1) % 7) as WeekDay;
}

export function answerRate(slot: Pick<ContactSlot, 'calls' | 'answered'>): number {
  return percent(slot.answered, slot.calls, 1);
}

export function heatLevel(rate: number, calls: number, minCalls = MIN_SLOT_CALLS): HeatLevel {
  if (calls < minCalls) return -1;
  const band = HEAT_THRESHOLDS.findIndex((t) => rate < t);
  return (band === -1 ? HEAT_THRESHOLDS.length : band) as HeatLevel;
}

/**
 * Top `n` (day, hour) buckets by answer rate. Ranked by the Wilson lower
 * bound so a bucket with 6/7 answered can't beat one with 140/180.
 */
export function topContactSlots(
  slots: ReadonlyArray<ContactSlot>,
  n = 3,
  minCalls = MIN_SLOT_CALLS,
): RankedSlot[] {
  return slots
    .filter((s) => s.calls >= minCalls)
    .map((s) => ({ s, score: wilsonLowerBound(s.answered, s.calls) }))
    .sort((a, b) => b.score - a.score || b.s.calls - a.s.calls)
    .slice(0, n)
    .map(({ s }, i) => ({ ...s, rate: answerRate(s), rank: i + 1 }));
}

/** Dense day × hour matrix (missing buckets become empty cells). */
export function buildHeatmap(
  slots: ReadonlyArray<ContactSlot>,
  top: ReadonlyArray<RankedSlot>,
  days: ReadonlyArray<WeekDay> = WEEK_DAYS,
  hours: ReadonlyArray<number> = WORK_HOURS,
): HeatCell[][] {
  const index = new Map(slots.map((s) => [key(s.day, s.hour), s]));
  const ranks = new Map(top.map((s) => [key(s.day, s.hour), s.rank]));
  return days.map((day) =>
    hours.map((hour) => {
      const s = index.get(key(day, hour));
      const calls = s?.calls ?? 0;
      const answered = s?.answered ?? 0;
      const rate = answerRate({ calls, answered });
      return {
        day,
        hour,
        calls,
        answered,
        rate,
        level: heatLevel(rate, calls),
        rank: ranks.get(key(day, hour)) ?? 0,
      };
    }),
  );
}

export function summarizeContact(slots: ReadonlyArray<ContactSlot>): ContactSummary {
  const totalCalls = sum(slots, (s) => s.calls);
  const totalAnswered = sum(slots, (s) => s.answered);
  return {
    totalCalls,
    totalAnswered,
    overallRate: percent(totalAnswered, totalCalls, 1),
    bestDay: bestBy(slots, (s) => s.day, (day, rate) => ({ day: day as WeekDay, rate })),
    bestHour: bestBy(slots, (s) => s.hour, (hour, rate) => ({ hour, rate })),
  };
}

/** `9` → `{ hour: 9, period: 'am' }`, `13` → `{ hour: 1, period: 'pm' }`. */
export function to12Hour(hour: number): { hour: number; period: 'am' | 'pm' } {
  const h = ((hour % 24) + 24) % 24;
  return { hour: h % 12 === 0 ? 12 : h % 12, period: h < 12 ? 'am' : 'pm' };
}

// ─────────── internals ───────────

function key(day: number, hour: number): string {
  return `${day}:${hour}`;
}

/** Groups by `pick`, then returns the group with the best (Wilson-ranked) answer rate. */
function bestBy<T>(
  slots: ReadonlyArray<ContactSlot>,
  pick: (s: ContactSlot) => number,
  build: (groupKey: number, rate: number) => T,
): T | null {
  const groups = new Map<number, { calls: number; answered: number }>();
  for (const s of slots) {
    const g = groups.get(pick(s)) ?? { calls: 0, answered: 0 };
    g.calls += s.calls;
    g.answered += s.answered;
    groups.set(pick(s), g);
  }
  let best: { k: number; score: number; rate: number } | null = null;
  for (const [k, g] of groups) {
    if (g.calls < MIN_SLOT_CALLS) continue;
    const score = wilsonLowerBound(g.answered, g.calls);
    if (!best || score > best.score) best = { k, score, rate: round(answerRate(g), 1) };
  }
  return best ? build(best.k, best.rate) : null;
}
