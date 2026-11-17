import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AnimatedNumberDirective } from '../../directives/animated-number.directive';

export type RingTone = 'brand' | 'success' | 'warning' | 'danger';

/**
 * Animated progress ring: the arc draws in from 0 on first paint and glides to
 * every new value (live updates), the number counts up alongside. Solid brand
 * colour, no gradients.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  imports: [AnimatedNumberDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.--size.px]="size()" [attr.data-tone]="tone()" role="img"
         [attr.aria-label]="ariaLabel() + ' ' + rounded() + '%'">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="ring__track" cx="60" cy="60" r="52" />
        <circle class="ring__value" cx="60" cy="60" r="52" pathLength="100"
                [attr.stroke-dasharray]="shown() + ' 100'" />
      </svg>
      <span class="ring__label">
        <b [appAnimatedNumber]="value()" [decimals]="decimals()" [duration]="1100" suffix="%"></b>
        @if (caption()) { <small>{{ caption() }}</small> }
      </span>
    </div>
  `,
  styles: `
    :host { display: inline-grid; }
    .ring { position: relative; width: var(--size); height: var(--size); display: grid; place-items: center; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    :host-context([dir='rtl']) svg { transform: rotate(-90deg) scaleY(-1); }
    circle { fill: none; stroke-width: 9; }
    .ring__track { stroke: var(--surface-3); }
    .ring__value {
      stroke: var(--brand-500);
      stroke-linecap: round;
      transition: stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ring[data-tone='success'] .ring__value { stroke: var(--success); }
    .ring[data-tone='warning'] .ring__value { stroke: var(--warning); }
    .ring[data-tone='danger'] .ring__value { stroke: var(--danger); }
    .ring__label { position: relative; display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
    .ring__label b { font-size: calc(var(--size) * 0.2); font-weight: var(--fw-800); color: var(--text-1); font-variant-numeric: tabular-nums; }
    .ring__label small { margin-top: 0.2rem; font-size: max(0.7rem, calc(var(--size) * 0.075)); color: var(--text-3); font-weight: var(--fw-600); }
    @media (prefers-reduced-motion: reduce) { .ring__value { transition: none; } }
  `,
})
export class ProgressRingComponent {
  readonly value = input<number>(0);
  readonly size = input(140);
  readonly caption = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly decimals = input(0);
  readonly tone = input<RingTone>('brand');

  /** Starts at 0 so the first paint draws the arc in. */
  private readonly mounted = signal(false);
  protected readonly shown = computed(() => (this.mounted() ? clamp(this.value()) : 0));
  protected readonly rounded = computed(() => Math.round(clamp(this.value())));

  constructor() {
    requestAnimationFrame(() => requestAnimationFrame(() => this.mounted.set(true)));
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Number(v) || 0));
}
