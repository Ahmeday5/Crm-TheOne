/**
 * Motion helpers — every decorative animation should check these so users
 * who asked the OS for reduced motion (and touch devices, for pointer
 * effects) get a calm, static UI.
 */

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;
}

export function prefersReducedMotion(): boolean {
  return matches('(prefers-reduced-motion: reduce)');
}

/** True for mouse / trackpad — pointer-follow effects are pointless on touch. */
export function hasFinePointer(): boolean {
  return matches('(hover: hover) and (pointer: fine)');
}

/** Standard ease-out-expo curve, `t` in [0, 1]. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
