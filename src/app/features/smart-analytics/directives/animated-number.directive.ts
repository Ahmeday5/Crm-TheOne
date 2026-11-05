import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { easeOutExpo, prefersReducedMotion } from '../../../shared/utils/motion.util';

/**
 * Tweens the host's text to a number — and keeps tweening from the old
 * value to the new one whenever the input changes (range / month switch),
 * unlike the shared one-shot `appCountUp`.
 *
 *   <strong [appAnimatedNumber]="rate" [decimals]="1" suffix="%"></strong>
 *
 * Writes `textContent` from a rAF loop outside Angular (zero change
 * detection). Reduced-motion users get the final value immediately.
 */
@Directive({
  selector: '[appAnimatedNumber]',
  standalone: true,
})
export class AnimatedNumberDirective {
  readonly value = input.required<number>({ alias: 'appAnimatedNumber' });
  readonly decimals = input(0);
  readonly suffix = input('');
  readonly duration = input(900);
  /** Delay before the *first* run only — later changes tween straight away. */
  readonly delay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  private current = 0;
  private started = false;
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const target = this.value();
      untracked(() => this.animateTo(Number.isFinite(target) ? target : 0));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private animateTo(target: number): void {
    this.stop();
    if (prefersReducedMotion()) {
      this.render(target);
      return;
    }
    const from = this.current;
    const wait = this.started ? 0 : this.delay();
    this.started = true;
    if (!this.host.nativeElement.textContent) this.render(from);

    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / this.duration(), 1);
          this.render(from + (target - from) * easeOutExpo(t));
          if (t < 1) this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
      }, wait);
    });
  }

  private render(value: number): void {
    this.current = value;
    const digits = this.decimals();
    this.host.nativeElement.textContent =
      new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(
        Number(value.toFixed(digits)),
      ) + this.suffix();
  }

  private stop(): void {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
  }
}
