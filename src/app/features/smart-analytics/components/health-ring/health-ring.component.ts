import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnimatedNumberDirective } from '../../directives/animated-number.directive';
import { HealthClass } from '../../models/smart-analytics.models';

export type HealthRingSize = 'sm' | 'md' | 'lg';

/**
 * Score ring 0–100: the arc draws itself while the number counts up.
 * Colour follows the health class (success / warning / danger).
 */
@Component({
  selector: 'app-health-ring',
  standalone: true,
  imports: [AnimatedNumberDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring ring-{{ size() }} cls-{{ healthClass() }}" [style.--p]="score()" [style.--delay]="delay() + 'ms'" role="img"
         [attr.aria-label]="label() || score() + '/100'">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle class="ring-track" cx="20" cy="20" r="16" pathLength="100" />
        <circle class="ring-arc" cx="20" cy="20" r="16" pathLength="100" />
      </svg>
      <span class="ring-value" [appAnimatedNumber]="score()" [duration]="1100" [delay]="delay()"></span>
    </div>
  `,
  styleUrl: './health-ring.component.scss',
})
export class HealthRingComponent {
  readonly score = input.required<number>();
  readonly healthClass = input.required<HealthClass>();
  readonly size = input<HealthRingSize>('md');
  /** Start delay in ms — lets a list of rings cascade. */
  readonly delay = input(0);
  readonly label = input<string>('');
}
