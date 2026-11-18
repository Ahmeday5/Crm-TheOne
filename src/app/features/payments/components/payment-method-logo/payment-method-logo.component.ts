import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PaymentMethodType } from '../../models/payments.models';
import { providerOf } from '../../utils/payment-providers.const';

/** Solid provider tile (brand colour + short mark) — no third-party logos bundled. */
@Component({
  selector: 'app-payment-method-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pml" [class.pml--lg]="size() === 'lg'" [style.background]="provider().color" aria-hidden="true">{{ provider().mark }}</span>`,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    .pml {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.5rem; height: 2.5rem; border-radius: var(--radius-md);
      color: #fff; font-weight: var(--fw-800); font-size: var(--fs-sm); letter-spacing: 0.02em;
      direction: ltr;
    }
    .pml--lg { width: 3.25rem; height: 3.25rem; font-size: var(--fs-md); border-radius: var(--radius-lg); }
  `,
})
export class PaymentMethodLogoComponent {
  readonly type = input.required<PaymentMethodType>();
  readonly size = input<'md' | 'lg'>('md');
  protected readonly provider = computed(() => providerOf(this.type()));
}
