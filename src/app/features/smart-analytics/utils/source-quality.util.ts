import { SourceQualityRow } from '../models/smart-analytics.models';
import { percent, ratio, round, sum } from './analytics-math.util';

/**
 * Source / campaign quality — pure ranking logic.
 *
 * Conversion = buyers ÷ customers of that source. The team average is
 * *weighted* (all buyers ÷ all customers) so one tiny source can't skew it.
 * Best / worst are only chosen among sources with a meaningful sample.
 */

/** Sources with fewer customers than this never get the best/worst badge. */
export const MIN_SOURCE_SAMPLE = 15;

export type SourceSortKey = 'name' | 'customers' | 'buyers' | 'conversionRate';
export type SortDirection = 'asc' | 'desc';
export type SourceTag = 'best' | 'worst' | null;

export interface RankedSource extends SourceQualityRow {
  /** 0–100, one decimal. */
  conversionRate: number;
  /** Share of all customers in the range, 0–100. */
  customerShare: number;
  /** Conversion relative to the best source, 0–1 (bar length). */
  relativeConversion: number;
  /** Percentage points above (+) / below (−) the weighted average. */
  deltaVsAverage: number;
  tag: SourceTag;
}

export interface SourceQualitySummary {
  rows: RankedSource[];
  best: RankedSource | null;
  worst: RankedSource | null;
  totalCustomers: number;
  totalBuyers: number;
  /** Weighted average conversion, 0–100. */
  averageConversion: number;
}

export function conversionRate(buyers: number, customers: number): number {
  return percent(buyers, customers, 1);
}

export function summarizeSources(
  input: ReadonlyArray<SourceQualityRow>,
  minSample = MIN_SOURCE_SAMPLE,
): SourceQualitySummary {
  const totalCustomers = sum(input, (r) => r.customers);
  const totalBuyers = sum(input, (r) => r.buyers);
  const averageConversion = conversionRate(totalBuyers, totalCustomers);

  const base = input.map((r) => ({
    ...r,
    conversionRate: conversionRate(r.buyers, r.customers),
    customerShare: percent(r.customers, totalCustomers, 1),
  }));
  const topRate = Math.max(0, ...base.map((r) => r.conversionRate));

  // Only sizeable sources compete; with fewer than two there's nothing to contrast.
  const eligible = base
    .filter((r) => r.customers >= minSample)
    .sort((a, b) => b.conversionRate - a.conversionRate || b.customers - a.customers);
  const bestId = eligible.length >= 2 ? eligible[0].id : null;
  const worstId = eligible.length >= 2 ? eligible[eligible.length - 1].id : null;

  const rows: RankedSource[] = base.map((r) => ({
    ...r,
    relativeConversion: ratio(r.conversionRate, topRate),
    deltaVsAverage: round(r.conversionRate - averageConversion, 1),
    tag: r.id === bestId ? 'best' : r.id === worstId ? 'worst' : null,
  }));

  return {
    rows,
    best: rows.find((r) => r.tag === 'best') ?? null,
    worst: rows.find((r) => r.tag === 'worst') ?? null,
    totalCustomers,
    totalBuyers,
    averageConversion,
  };
}

export function sortSources(
  rows: ReadonlyArray<RankedSource>,
  key: SourceSortKey,
  direction: SortDirection,
  collator: Intl.Collator = new Intl.Collator('ar'),
): RankedSource[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary =
      key === 'name' ? collator.compare(a.name, b.name) : (a[key] as number) - (b[key] as number);
    // Stable, meaningful tie-break: bigger sources first.
    return primary * sign || b.customers - a.customers;
  });
}
