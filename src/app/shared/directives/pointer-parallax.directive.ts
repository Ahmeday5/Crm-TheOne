import { DestroyRef, Directive, ElementRef, NgZone, OnInit, inject } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from '../utils/motion.util';

/**
 * Publishes the pointer position over the host as CSS custom properties so
 * stylesheets can build parallax / spotlight effects without any JS per layer:
 *
 *   --px, --py   normalised offset from the centre, in [-0.5, 0.5]
 *   --mx, --my   absolute position inside the host, in px
 *
 *   <section appPointerParallax>
 *     <div class="layer" style="--depth: 30"></div>
 *   </section>
 *
 *   .layer { transform: translate(calc(var(--px, 0) * var(--depth) * 1px), …); }
 *
 * Runs outside Angular (no change detection per mouse move), is throttled to
 * one write per frame, and is a no-op on touch or reduced-motion setups.
 */
@Directive({
  selector: '[appPointerParallax]',
  standalone: true,
})
export class PointerParallaxDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (prefersReducedMotion() || !hasFinePointer()) return;

    const el = this.host.nativeElement;
    let frame = 0;

    const write = (x: number, y: number, mx: number, my: number) => {
      el.style.setProperty('--px', x.toFixed(4));
      el.style.setProperty('--py', y.toFixed(4));
      el.style.setProperty('--mx', `${Math.round(mx)}px`);
      el.style.setProperty('--my', `${Math.round(my)}px`);
    };

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        write(mx / r.width - 0.5, my / r.height - 0.5, mx, my);
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      const r = el.getBoundingClientRect();
      write(0, 0, r.width / 2, r.height / 2);
    };

    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave, { passive: true });
    });

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  }
}
