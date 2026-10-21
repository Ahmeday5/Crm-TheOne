import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

/**
 * Viewport breakpoints as signals — the TypeScript twin of
 * `src/styles/_breakpoints.scss` (keep both maps in sync).
 *
 * Backed by `matchMedia`, so it only fires when a threshold is crossed
 * (never on every resize pixel) and stays in lock-step with the CSS.
 *
 *   private readonly bp = inject(BreakpointService);
 *   readonly compact = this.bp.isMobile;   // Signal<boolean>
 */
export const BREAKPOINTS = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Phones (< 768px) — tables collapse to cards, pagination goes compact. */
  readonly isMobile = this.below('md');
  /** Phones + tablets (< 992px) — the sidebar becomes an off-canvas drawer. */
  readonly isTabletDown = this.below('lg');

  /** True while the viewport is narrower than the named breakpoint. */
  below(name: BreakpointName): Signal<boolean> {
    return this.query(`(max-width: ${BREAKPOINTS[name] - 0.02}px)`);
  }

  private query(media: string): Signal<boolean> {
    const mql = this.doc.defaultView?.matchMedia?.(media);
    const state = signal(mql?.matches ?? false);
    if (!mql) return state.asReadonly();

    const onChange = (e: MediaQueryListEvent) => state.set(e.matches);
    mql.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', onChange));
    return state.asReadonly();
  }
}
