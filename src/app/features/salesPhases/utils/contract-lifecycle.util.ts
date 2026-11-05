import { ContractListItem } from '../../../shared/models';

/**
 * Single source of truth for "what state is this contract really in?".
 * Pure (no Angular) so tabs, KPI cards, row badges and exports can never
 * disagree with each other.
 *
 *   cancelled  status = Cancelled (wins over dates)
 *   expired    status = Expired, or the end date has passed
 *   expiring   still active and ends within EXPIRING_WINDOW_DAYS
 *   active     everything else (incl. open-ended contracts without endDate)
 */
export type ContractLifecycle = 'active' | 'expiring' | 'expired' | 'cancelled';

/** An active contract counts as "expiring soon" when it ends within… */
export const EXPIRING_WINDOW_DAYS = 90;

const DAY_MS = 86_400_000;

/** Whole days until the end date (negative once passed); null = no end date. */
export function daysUntilEnd(endDate: string | null | undefined, now = Date.now()): number | null {
  if (!endDate) return null;
  const end = Date.parse(endDate);
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now) / DAY_MS);
}

export function contractLifecycle(
  row: Pick<ContractListItem, 'status' | 'endDate'>,
  now = Date.now(),
): ContractLifecycle {
  if (row.status === 'Cancelled') return 'cancelled';
  const days = daysUntilEnd(row.endDate, now);
  if (row.status === 'Expired' || (days !== null && days < 0)) return 'expired';
  if (days !== null && days <= EXPIRING_WINDOW_DAYS) return 'expiring';
  return 'active';
}

export interface ContractCounts {
  all: number;
  /** Active including the ones expiring soon (they are still active). */
  active: number;
  expiring: number;
  expired: number;
  cancelled: number;
}

export function countContracts(rows: ReadonlyArray<Pick<ContractListItem, 'status' | 'endDate'>>, now = Date.now()): ContractCounts {
  const counts: ContractCounts = { all: rows.length, active: 0, expiring: 0, expired: 0, cancelled: 0 };
  for (const row of rows) {
    const state = contractLifecycle(row, now);
    if (state === 'expiring') {
      counts.expiring++;
      counts.active++;
    } else {
      counts[state]++;
    }
  }
  return counts;
}
