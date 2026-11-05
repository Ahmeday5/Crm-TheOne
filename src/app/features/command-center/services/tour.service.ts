import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { TOUR_STEPS, TourStep } from '../config/tour-steps.const';

const DONE_KEY = 'crm.tour.done';

/**
 * Role-aware onboarding tour state. Rendering/positioning lives in
 * `ProductTourComponent`; this service only knows steps and progress.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly auth = inject(AuthService);

  readonly active = signal(false);
  readonly index = signal(0);

  readonly steps = computed<TourStep[]>(() => {
    const role = this.auth.currentRole();
    return TOUR_STEPS.filter((s) => !s.roles || (!!role && s.roles.includes(role)));
  });

  readonly step = computed(() => this.steps()[this.index()] ?? null);
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() === this.steps().length - 1);

  start(): void {
    this.index.set(0);
    this.active.set(true);
  }

  /** First visit for this user on this device? */
  shouldAutoStart(): boolean {
    try {
      return localStorage.getItem(this.doneKey()) !== '1';
    } catch {
      return false;
    }
  }

  next(): void {
    if (this.isLast()) this.finish();
    else this.index.update((i) => i + 1);
  }

  prev(): void {
    if (!this.isFirst()) this.index.update((i) => i - 1);
  }

  goTo(i: number): void {
    if (i >= 0 && i < this.steps().length) this.index.set(i);
  }

  /** Skip and finish both count as "seen" — never nag twice. */
  finish(): void {
    this.active.set(false);
    try {
      localStorage.setItem(this.doneKey(), '1');
    } catch {
      /* ignore */
    }
  }

  private doneKey(): string {
    return `${DONE_KEY}.${this.auth.currentUser()?.userId ?? 'anon'}`;
  }
}
