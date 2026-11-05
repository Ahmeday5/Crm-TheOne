import { Signal, computed, signal } from '@angular/core';
import { Observable, Subscription, finalize } from 'rxjs';

/**
 * One independently-loading piece of remote state: value + loading + error.
 *
 * `load()` has switch semantics — a newer request cancels the older one, so
 * a quick range/month change can never paint stale data. The last good
 * value stays on screen while the next one loads (no flash to skeleton).
 */
export class AsyncSlice<T> {
  private readonly valueSig = signal<T | null>(null);
  private readonly loadingSig = signal(false);
  private readonly errorSig = signal(false);
  private sub?: Subscription;

  readonly value: Signal<T | null> = this.valueSig.asReadonly();
  readonly loading: Signal<boolean> = this.loadingSig.asReadonly();
  readonly error: Signal<boolean> = this.errorSig.asReadonly();
  /** At least one successful load. */
  readonly loaded = computed(() => this.valueSig() !== null);

  load(source: Observable<T>): void {
    // Unsubscribing runs the previous `finalize` first, then we flip back on.
    this.sub?.unsubscribe();
    this.loadingSig.set(true);
    this.errorSig.set(false);
    this.sub = source.pipe(finalize(() => this.loadingSig.set(false))).subscribe({
      next: (value) => this.valueSig.set(value),
      error: () => this.errorSig.set(true),
    });
  }

  /** Local, synchronous update (e.g. after a successful save). */
  update(fn: (value: T) => T): void {
    const current = this.valueSig();
    if (current !== null) this.valueSig.set(fn(current));
  }

  dispose(): void {
    this.sub?.unsubscribe();
  }
}
