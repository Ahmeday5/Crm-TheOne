import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { easeOutExpo, prefersReducedMotion } from '../utils/motion.util';

/**
 * Animates a number from 0 up to its value once the host scrolls into view.
 *
 *   <span [appCountUp]="99" suffix="%"></span>
 *   <span [appCountUp]="24" suffix="/7" [delay]="300"></span>
 *
 * Writes `textContent` directly from a rAF loop outside Angular, so the
 * animation costs zero change-detection cycles. Reduced-motion users get the
 * final value straight away.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnInit {
  readonly appCountUp = input.required<number>();
  readonly prefix = input('');
  readonly suffix = input('');
  /** Animation length in ms. */
  readonly duration = input(1800);
  /** Wait before starting, in ms — useful to sync with entrance animations. */
  readonly delay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const target = this.appCountUp();
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.render(target);
      return;
    }

    this.render(0);
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / this.duration(), 1);
        this.render(Math.round(target * easeOutExpo(t)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Created outside the zone so the observer callback, timer and rAF loop
    // never trigger change detection.
    const observer = this.zone.runOutsideAngular(
      () =>
        new IntersectionObserver(([entry]) => {
          if (!entry?.isIntersecting) return;
          observer.disconnect();
          timer = setTimeout(run, this.delay());
        }),
    );
    observer.observe(this.host.nativeElement);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    });
  }

  private render(value: number): void {
    this.host.nativeElement.textContent = `${this.prefix()}${value}${this.suffix()}`;
  }
}
