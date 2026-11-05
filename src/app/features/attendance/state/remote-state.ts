import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';

/**
 * One server-loaded value with its request state, as signals.
 *
 *  - `load()` cancels the previous request (latest wins — no stale overwrite).
 *  - `quiet` keeps the current value on screen (background refresh).
 *  - A failed load keeps the last good value; `error` holds the server's
 *    message ('' when it sent none).
 */
export class RemoteState<T> {
  private readonly valueSig: WritableSignal<T>;
  private readonly loadingSig = signal(false);
  private readonly loadedSig = signal(false);
  private readonly errorSig = signal<string | null>(null);
  private sub?: Subscription;

  readonly value: Signal<T>;
  readonly loading = this.loadingSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly error = this.errorSig.asReadonly();
  /** First load still running (show a skeleton, not a spinner over data). */
  readonly initializing = computed(() => !this.loadedSig() && this.errorSig() === null);

  constructor(private readonly initial: T) {
    this.valueSig = signal<T>(initial);
    this.value = this.valueSig.asReadonly();
  }

  load(source: Observable<T>, quiet = false): void {
    this.sub?.unsubscribe();
    if (!quiet) this.loadingSig.set(true);
    this.errorSig.set(null);
    this.sub = source.subscribe({
      next: (value) => {
        this.valueSig.set(value);
        this.loadedSig.set(true);
        this.loadingSig.set(false);
      },
      error: (err: ApiError) => {
        this.errorSig.set(err?.message?.trim() ?? '');
        this.loadingSig.set(false);
      },
    });
  }

  /** Local optimistic / post-mutation edit. */
  update(fn: (value: T) => T): void {
    this.valueSig.update(fn);
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.valueSig.set(this.initial);
    this.loadedSig.set(false);
    this.loadingSig.set(false);
    this.errorSig.set(null);
  }
}
