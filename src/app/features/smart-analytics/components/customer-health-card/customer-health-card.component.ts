import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomerHealth, HealthFactor } from '../../models/smart-analytics.models';
import { HealthRingComponent } from '../health-ring/health-ring.component';

const FACTOR_ICONS: Readonly<Record<HealthFactor, string>> = {
  volume: 'fa-solid fa-layer-group',
  open: 'fa-solid fa-envelope-open-text',
  priority: 'fa-solid fa-fire',
  age: 'fa-solid fa-hourglass-half',
};

/** One customer: score ring, ticket facts and an expandable "what lowered the score". */
@Component({
  selector: 'app-customer-health-card',
  standalone: true,
  imports: [TranslatePipe, TipDirective, HealthRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-health-card.component.html',
  styleUrl: './customer-health-card.component.scss',
})
export class CustomerHealthCardComponent {
  readonly customer = input.required<CustomerHealth>();
  /** Position in the list — staggers the entrance. */
  readonly index = input(0);

  readonly expanded = signal(false);
  readonly factorIcons = FACTOR_ICONS;

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
