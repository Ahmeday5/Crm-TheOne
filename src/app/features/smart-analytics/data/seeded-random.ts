/**
 * Deterministic pseudo-random numbers for the mock adapter.
 *
 * The same seed string always yields the same sequence, so sample data is
 * stable across reloads and identical for every viewer — the page behaves
 * like it's reading a real database, not rolling dice.
 */

/** FNV-1a 32-bit hash of a string → seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 0x9e3779b9;
  }

  /** Mulberry32 — fast, small, good enough for sample data. Returns [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** `true` with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: ReadonlyArray<T>): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Picks by relative weight: `weighted([['a', 3], ['b', 1]])` → 'a' 75% of the time. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  /** Binomial-ish draw: how many of `n` trials succeed with probability `p`. */
  successes(n: number, p: number): number {
    // Normal approximation keeps big samples cheap; exact loop for small ones.
    if (n > 60) {
      const mean = n * p;
      const sd = Math.sqrt(n * p * (1 - p));
      const z = Math.sqrt(-2 * Math.log(1 - this.next())) * Math.cos(2 * Math.PI * this.next());
      return Math.max(0, Math.min(n, Math.round(mean + z * sd)));
    }
    let k = 0;
    for (let i = 0; i < n; i++) if (this.next() < p) k++;
    return k;
  }
}
