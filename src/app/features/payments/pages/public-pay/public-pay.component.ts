import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { validateImageFile } from '../../../../core/utils/image-file.util';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { QrCodeComponent } from '../../../../shared/components/qr-code/qr-code.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentMethodLogoComponent } from '../../components/payment-method-logo/payment-method-logo.component';
import { PayWalletOptionComponent } from '../../components/pay-wallet-option/pay-wallet-option.component';
import { PaymentsService } from '../../data/payments.gateway';
import { PublicPayment, WALLET_TYPES, isWallet } from '../../models/payments.models';
import { detectPlatform, instapayUrl, localMobile, openAppUrl } from '../../utils/pay-links.util';
import { providerOf } from '../../utils/payment-providers.const';
import { formatAmount } from '../../utils/payment-message.util';

type PageState = 'loading' | 'ready' | 'notFound' | 'error';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * `/pay/:token` — the anonymous page the customer opens from WhatsApp.
 *
 * Wallet request → big "Open <wallet app>" + its USSD code, then "No
 * Vodafone? Pay from your wallet" with the other three wallets (open app /
 * USSD code to the SAME number) and InstaPay → wallet.
 * InstaPay request → "Open InstaPay" (the account's ipn.eg link opens the
 * recipient's profile directly) + IPA / number to copy.
 * Then "I've paid" → receipt (required) + number / reference → staff confirm by hand.
 */
@Component({
  selector: 'app-public-pay',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CairoDatePipe,
    CopyButtonComponent,
    QrCodeComponent,
    LanguageToggleComponent,
    MockRibbonComponent,
    PaymentMethodLogoComponent,
    PayWalletOptionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-pay.component.html',
  styleUrl: './public-pay.component.scss',
})
export class PublicPayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly payments = inject(PaymentsService);
  private readonly language = inject(LanguageService);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly platform = detectPlatform();
  protected readonly pageUrl = typeof location === 'undefined' ? '' : location.href;
  protected readonly state = signal<PageState>('loading');
  protected readonly payment = signal<PublicPayment | null>(null);

  // "I've paid" form
  protected payerPhone = '';
  protected payerReference = '';
  protected readonly receipt = signal<File | null>(null);
  /** Object URL for the receipt thumbnail — revoked on change / destroy. */
  protected readonly receiptPreview = signal<string | null>(null);
  protected readonly receiptMissing = signal(false);
  protected readonly confirming = signal(false);
  protected readonly confirmError = signal<string | null>(null);

  protected readonly method = computed(() => this.payment()?.method ?? null);
  protected readonly wallet = computed(() => {
    const m = this.method();
    return !!m && isWallet(m.type);
  });
  protected readonly provider = computed(() => {
    const m = this.method();
    return m ? providerOf(m.type) : null;
  });
  protected readonly amountText = computed(() => formatAmount(this.payment()?.amount ?? 0));
  /** Section 9.4: the price before the discount, struck through, when there is one. */
  protected readonly originalText = computed(() => {
    const p = this.payment();
    return p && p.originalAmount > p.amount ? formatAmount(p.originalAmount) : null;
  });
  protected readonly recipientPhone = computed(() => localMobile(this.method()?.phoneNumber));
  /** The wallets the payer may use instead of the one the request was sent on. */
  protected readonly otherWallets = computed(() => WALLET_TYPES.filter((t) => t !== this.method()?.type));
  protected readonly instapayHref = computed(() => {
    const m = this.method();
    return m ? instapayUrl(m, this.platform) : '';
  });
  protected readonly instapayAppHref = openAppUrl(providerOf('InstaPay'), this.platform);
  protected readonly hasInstapayLink = computed(() => !!this.method()?.instapayLink);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!this.token) {
      this.state.set('notFound');
      return;
    }
    this.state.set('loading');
    this.payments.gateway.get(this.token).subscribe({
      next: (p) => {
        this.payment.set(p);
        this.state.set('ready');
      },
      error: (err: ApiError) => this.state.set(err?.status === 404 ? 'notFound' : 'error'),
    });
  }

  protected onReceipt(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (validateImageFile(file) || !RECEIPT_TYPES.includes(file.type)) {
      this.confirmError.set(this.t('payments.pay.confirm.imageInvalid'));
      return;
    }
    this.confirmError.set(null);
    this.setReceipt(file);
  }

  protected clearReceipt(): void {
    this.setReceipt(null);
  }

  ngOnDestroy(): void {
    this.setReceipt(null);
  }

  private setReceipt(file: File | null): void {
    const old = this.receiptPreview();
    if (old) URL.revokeObjectURL(old);
    this.receipt.set(file);
    this.receiptPreview.set(file ? URL.createObjectURL(file) : null);
    if (file) this.receiptMissing.set(false);
  }

  protected confirm(): void {
    if (this.confirming()) return;
    const phone = this.payerPhone.replace(/[\s-]/g, '');
    const ref = this.payerReference.trim();
    // The receipt is mandatory — it's what staff verify the transfer against.
    if (!this.receipt()) {
      this.receiptMissing.set(true);
      this.confirmError.set(this.t('payments.pay.confirm.receiptRequired'));
      return;
    }
    if (!phone && !ref) {
      this.confirmError.set(this.t('payments.pay.confirm.needSomething'));
      return;
    }
    this.confirming.set(true);
    this.confirmError.set(null);
    this.payments.gateway.confirm(this.token, { payerPhone: phone || null, payerReference: ref || null, receipt: this.receipt() }).subscribe({
      next: (p) => {
        this.confirming.set(false);
        this.payment.set(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: ApiError) => {
        this.confirming.set(false);
        // Missing / wrong-type / too-big receipt — point at the picker, not a generic error.
        if (err?.reason === 'INVALID_FILE') {
          this.receiptMissing.set(true);
          this.confirmError.set(err.message || this.t('payments.pay.confirm.receiptRequired'));
          return;
        }
        this.confirmError.set(err?.message || this.t('payments.pay.state.errorHint'));
        // The request moved on (expired / cancelled / paid) — show its real state.
        if (err?.status === 409) this.load();
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
