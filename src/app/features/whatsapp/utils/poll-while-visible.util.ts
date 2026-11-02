import {
  EMPTY,
  Observable,
  distinctUntilChanged,
  fromEvent,
  map,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

/**
 * Ticks every `periodMs` while the browser tab is visible.
 *
 * - The first tick comes after one full period (callers load immediately
 *   themselves).
 * - While the tab is hidden nothing fires — a backgrounded inbox shouldn't
 *   keep hitting the server.
 * - Coming back to the tab ticks at once, so the view is fresh on return.
 */
export function pollWhileVisible(periodMs: number): Observable<void> {
  if (typeof document === 'undefined') {
    return timer(periodMs, periodMs).pipe(map(() => undefined));
  }

  const isVisible = () => document.visibilityState === 'visible';

  return fromEvent(document, 'visibilitychange').pipe(
    map(isVisible),
    startWith(isVisible()),
    distinctUntilChanged(),
    switchMap((visible, i) => (visible ? timer(i === 0 ? periodMs : 0, periodMs) : EMPTY)),
    map(() => undefined),
  );
}
