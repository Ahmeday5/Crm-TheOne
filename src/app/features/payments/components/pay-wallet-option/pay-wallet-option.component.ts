import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentMethodType } from '../../models/payments.models';
import { DevicePlatform, localMobile, openAppUrl, ussdFor } from '../../utils/pay-links.util';
import { providerOf } from '../../utils/payment-providers.const';
import { formatAmount } from '../../utils/payment-message.util';
import { PaymentMethodLogoComponent } from '../payment-method-logo/payment-method-logo.component';

/**
 * One way to pay a WALLET request from the payer's own wallet (`payerType`):
 *   - "Open app"  → the payer's wallet app (Android intent / App Store),
 *   - "USSD code" → the transfer code to the recipient's number (dial on
 *     Android, copy on iPhone — iOS blocks `*`/`#` in tel: links).
 * `primary` = the wallet the request was sent on: big button, code shown.
 */
@Component({
  selector: 'app-pay-wallet-option',
  standalone: true,
  imports: [TranslatePipe, CopyButtonComponent, PaymentMethodLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pay-wallet-option.component.html',
  styleUrl: './pay-wallet-option.component.scss',
})
export class PayWalletOptionComponent {
  readonly payerType = input.required<PaymentMethodType>();
  readonly recipientPhone = input<string | null>(null);
  readonly amount = input.required<number>();
  readonly platform = input.required<DevicePlatform>();
  readonly primary = input(false);

  protected readonly showCode = signal(false);
  protected readonly provider = computed(() => providerOf(this.payerType()));
  protected readonly appUrl = computed(() => openAppUrl(this.provider(), this.platform()));
  protected readonly ussd = computed(() => ussdFor(this.payerType(), this.recipientPhone(), this.amount()));
  protected readonly phone = computed(() => localMobile(this.recipientPhone()));
  protected readonly amountText = computed(() => formatAmount(Math.ceil(this.amount())));
  protected readonly codeVisible = computed(() => this.primary() || this.showCode());
}
