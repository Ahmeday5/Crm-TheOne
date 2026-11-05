import {
  CustomerHealth,
  CustomerTickets,
  HealthClass,
  HealthFactor,
  HealthPenalty,
  HealthTicket,
  TicketPriority,
} from '../models/smart-analytics.models';
import { clamp } from './analytics-math.util';

/**
 * Customer health score — the single source of truth for the formula.
 *
 * Every customer starts at 100 and loses points on four capped factors.
 * The caps add up to exactly 100, so the score is always 0–100:
 *
 *   volume   −3 per ticket opened in the last 90 days        (max −15)
 *   open     −6 per ticket still open                         (max −30)
 *   priority per open ticket: medium −4, high −8, urgent −14  (max −30)
 *   age      per open ticket, by days open:
 *            > 3d −2, > 7d −5, > 14d −9, > 30d −14            (max −25)
 *
 * Classes: healthy ≥ 70, at risk 40–69, critical < 40.
 *
 * If this changes, update `docs/api/smart-analytics.md` and the i18n
 * `smartAnalytics.health.formula.*` strings in the same commit.
 */

export const HEALTH_WINDOW_DAYS = 90;
export const HEALTHY_MIN = 70;
export const AT_RISK_MIN = 40;

export const HEALTH_RULES = {
  volume: { perTicket: 3, cap: 15 },
  open: { perTicket: 6, cap: 30 },
  priority: {
    cap: 30,
    weights: { low: 0, medium: 4, high: 8, urgent: 14 } as Readonly<Record<TicketPriority, number>>,
  },
  age: {
    cap: 25,
    /** Checked top-down: the first band whose `overDays` is exceeded applies. */
    bands: [
      { overDays: 30, points: 14 },
      { overDays: 14, points: 9 },
      { overDays: 7, points: 5 },
      { overDays: 3, points: 2 },
    ],
  },
} as const;

const DAY_MS = 86_400_000;

export function healthClass(score: number): HealthClass {
  if (score >= HEALTHY_MIN) return 'healthy';
  if (score >= AT_RISK_MIN) return 'atRisk';
  return 'critical';
}

/** Whole days between `iso` and `now` (never negative). */
export function ageInDays(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function agePenalty(days: number): number {
  return HEALTH_RULES.age.bands.find((b) => days > b.overDays)?.points ?? 0;
}

export function scoreCustomer(c: CustomerTickets, now: Date = new Date()): CustomerHealth {
  const recent = c.tickets.filter(
    (t) => t.isOpen || ageInDays(t.openedAt, now) <= HEALTH_WINDOW_DAYS,
  );
  const open = recent.filter((t) => t.isOpen);
  const ages = open.map((t) => ageInDays(t.openedAt, now));
  const urgentish = open.filter((t) => t.priority === 'high' || t.priority === 'urgent').length;

  const penalties: HealthPenalty[] = [
    penalty('volume', recent.length * HEALTH_RULES.volume.perTicket, HEALTH_RULES.volume.cap, recent.length),
    penalty('open', open.length * HEALTH_RULES.open.perTicket, HEALTH_RULES.open.cap, open.length),
    penalty('priority', priorityPoints(open), HEALTH_RULES.priority.cap, urgentish),
    penalty(
      'age',
      ages.reduce((s, d) => s + agePenalty(d), 0),
      HEALTH_RULES.age.cap,
      Math.max(0, ...ages),
    ),
  ]
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points);

  const score = clamp(100 - penalties.reduce((s, p) => s + p.points, 0), 0, 100);

  return {
    customerId: c.customerId,
    customerName: c.customerName,
    phone: c.phone,
    ownerName: c.ownerName,
    score,
    healthClass: healthClass(score),
    penalties,
    totalTickets: recent.length,
    openTickets: open.length,
    oldestOpenDays: Math.max(0, ...ages),
  };
}

export interface HealthDistribution {
  total: number;
  averageScore: number;
  counts: Record<HealthClass, number>;
  /** 0–100 shares; always sum to 100 when `total > 0`. */
  shares: Record<HealthClass, number>;
}

export function healthDistribution(rows: ReadonlyArray<CustomerHealth>): HealthDistribution {
  const counts: Record<HealthClass, number> = { healthy: 0, atRisk: 0, critical: 0 };
  for (const r of rows) counts[r.healthClass]++;
  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const healthy = pct(counts.healthy);
  const atRisk = pct(counts.atRisk);
  return {
    total,
    averageScore: total ? Math.round(rows.reduce((s, r) => s + r.score, 0) / total) : 0,
    counts,
    // The last share absorbs rounding so the stacked bar always fills exactly.
    shares: { healthy, atRisk, critical: total ? Math.max(0, Math.round((100 - healthy - atRisk) * 10) / 10) : 0 },
  };
}

// ─────────── internals ───────────

function priorityPoints(open: ReadonlyArray<HealthTicket>): number {
  return open.reduce((s, t) => s + HEALTH_RULES.priority.weights[t.priority], 0);
}

function penalty(factor: HealthFactor, raw: number, cap: number, count: number): HealthPenalty {
  return { factor, points: Math.min(raw, cap), cap, count };
}
