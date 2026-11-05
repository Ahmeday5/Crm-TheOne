/**
 * Small numeric helpers shared by every analytics section.
 * Pure — no Angular, no I/O.
 */

/** `part / whole` in [0, 1]; `0` when there is nothing to divide by. */
export function ratio(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(1, Math.max(0, part / whole));
}

/** Percentage rounded to `digits` decimals (`37.5` for 3/8). */
export function percent(part: number, whole: number, digits = 1): number {
  return round(ratio(part, whole) * 100, digits);
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum<T>(rows: ReadonlyArray<T>, pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0);
}

/**
 * Lower bound of the Wilson score interval (95% by default).
 *
 * Ranks rates by "how sure are we it's at least this good": 9/10 answered
 * ranks below 160/200, because ten calls prove little. Used wherever we
 * pick a "best" bucket so small samples can't win by luck.
 */
export function wilsonLowerBound(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0) return 0;
  const p = ratio(successes, trials);
  const z2 = z * z;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (centre - margin) / (1 + z2 / trials));
}
