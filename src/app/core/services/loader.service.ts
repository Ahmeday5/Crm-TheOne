import { Injectable, computed, signal } from '@angular/core';

/**
 * Counter-based global loader. The interceptor calls `show()` on request start
 * and `hide()` on request finish; `isLoading` flips on whenever there's at
 * least one in-flight request that didn't opt out via `SKIP_LOADER`.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly requestCount = signal(0);

  readonly isLoading = computed(() => this.requestCount() > 0);

  show(): void {
    this.requestCount.update((c) => c + 1);
  }

  hide(): void {
    this.requestCount.update((c) => Math.max(0, c - 1));
  }
}
