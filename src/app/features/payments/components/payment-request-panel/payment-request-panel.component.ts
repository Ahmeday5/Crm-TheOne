import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DiscountDraftsService } from '../../../discount-approvals/data/discount-drafts.service';
import { DiscountApproval } from '../../../discount-approvals/models/discount-approvals.models';
import { RouterLink } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { SlidePanelComponent } from '../../../../shared/components/slide-panel/slide-panel.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentsService } from '../../data/payments.gateway';
import { PaymentMethod, PaymentRequest, isWallet } from '../../models/payments.models';
import { PaymentMethodLogoComponent } from '../payment-method-logo/payment-method-logo.component';
import {
  DiscountApprovalBoxComponent,
  DiscountGateState,
} from '../../../discount-approvals/components/discount-approval-box/discount-approval-box.component';
import { discountPercent, formatPercent } from '../../../discount-approvals/utils/discount.util';

/** Who the request is for — filled from the open chat. */
export interface PaymentRequestContext {
  chatId: number | null;
  customerId: number | null;
  customerName: string | null;
  /** Any format; digits are kept. */
  customerPhone: string | null;
  /** Reopen with the values of an earlier discount request (and its approved code). */
  resumeApprovalId?: number | null;
}

const PHONE_RE = /^\+?\d{8,15}$/;

/** WhatsApp / CRM numbers → `+2010…` (local `01…` becomes `+201…`). */
function normalizePhone(raw: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 11) return `+2${digits}`;
  return `+${digits}`;
}

function phoneOrEmail(group: AbstractControl): ValidationErrors | null {
  const phone = String(group.get('customerPhone')?.value ?? '').trim();
  const email = String(group.get('customerEmail')?.value ?? '').trim();
  return phone || email ? null : { contactRequired: true };
}

/** Section 9.4: the discount is optional, >= 0 and below the amount. */
function discountBelowAmount(group: AbstractControl): ValidationErrors | null {
  const amount = Number(group.get('amount')?.value) || 0;
  const discount = Number(group.get('discount')?.value) || 0;
  return discount > 0 && amount > 0 && discount >= amount ? { discountTooBig: true } : null;
}

function optionalPhone(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').replace(/[\s-]/g, '');
  return !v || PHONE_RE.test(v) ? null : { phone: true };
}

/**
 * "New payment request" drawer, opened from the chat composer:
 *   1. pick the account (InstaPay / a wallet) the customer pays to,
 *   2. amount + description + validity,
 *   3. customer details (pre-filled from the chat).
 * Emits the created request; the host sends the link in the conversation.
 */
@Component({
  selector: 'app-payment-request-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    SlidePanelComponent,
    MockRibbonComponent,
    PaymentMethodLogoComponent,
    DiscountApprovalBoxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-request-panel.component.html',
  styleUrl: './payment-request-panel.component.scss',
})
export class PaymentRequestPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly payments = inject(PaymentsService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drafts = inject(DiscountDraftsService);
  /** The approval request this form is tied to (made here, or resumed). */
  private approvalId: number | null = null;
  private contactLookup: Subscription | null = null;

  readonly open = input.required<boolean>();
  readonly context = input<PaymentRequestContext | null>(null);

  readonly created = output<PaymentRequest>();
  readonly closed = output<void>();

  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly loadingMethods = signal(false);
  protected readonly methodsError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  protected readonly isWallet = isWallet;

  protected readonly form = this.fb.group(
    {
      methodId: this.fb.control<number | null>(null, Validators.required),
      amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(1_000_000)]),
      discount: this.fb.control<number | null>(null, Validators.min(0)),
      description: this.fb.nonNullable.control('', Validators.maxLength(200)),
      validityDays: this.fb.nonNullable.control(14, [Validators.required, Validators.min(1), Validators.max(90)]),
      customerName: this.fb.nonNullable.control('', Validators.maxLength(120)),
      customerPhone: this.fb.nonNullable.control('', optionalPhone),
      customerEmail: this.fb.nonNullable.control('', Validators.email),
    },
    { validators: [phoneOrEmail, discountBelowAmount] },
  );

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly amountPreview = computed(() => {
    const n = Number(this.value().amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  /** Discount as typed (0 when empty / invalid). */
  protected readonly discountPreview = computed(() => {
    const n = Number(this.value().discount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  /** What the customer pays: the big number on the summary. */
  protected readonly netPreview = computed(() => Math.max(0, this.amountPreview() - this.discountPreview()));
  protected readonly discountPercentText = computed(() => {
    const pct = discountPercent(this.amountPreview(), this.discountPreview());
    return pct > 0 ? formatPercent(pct) : null;
  });
  protected readonly customerNamePreview = computed(() => String(this.value().customerName ?? '').trim() || null);

  /** Manager-approval gate (docs/backend-prompt-inbox-v4.md section 9): submit stays disabled until `ready`. */
  protected readonly gate = signal<DiscountGateState>({ required: false, ready: true, code: null });
  private readonly approvalBox = viewChild(DiscountApprovalBoxComponent);

  protected readonly selected = computed(() => this.methods().find((m) => m.id === this.value().methodId) ?? null);

  constructor() {
    // Each opening starts fresh, pre-filled from the chat.
    effect(() => {
      if (!this.open()) return;
      const ctx = this.context();
      untracked(() => this.reset(ctx));
    });
  }

  protected close(): void {
    if (!this.submitting()) this.closed.emit();
  }

  protected loadMethods(): void {
    this.loadingMethods.set(true);
    this.methodsError.set(false);
    this.payments.gateway.methods().subscribe({
      next: (list) => {
        this.methods.set(list);
        this.loadingMethods.set(false);
        if (!this.form.controls.methodId.value && list.length) this.form.controls.methodId.setValue(list[0].id);
      },
      error: () => {
        this.loadingMethods.set(false);
        this.methodsError.set(true);
      },
    });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected discountTooBig(): boolean {
    return this.form.hasError('discountTooBig');
  }

  protected contactMissing(): boolean {
    const touched = this.form.controls.customerPhone.touched || this.form.controls.customerEmail.touched;
    return touched && this.form.hasError('contactRequired');
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const gate = this.gate();
    if (!gate.ready) {
      this.error.set(this.t('discounts.box.saveBlocked'));
      return;
    }
    const v = this.form.getRawValue();
    const ctx = this.context();
    const discount = Math.round(Math.max(0, Number(v.discount) || 0) * 100) / 100;
    this.submitting.set(true);
    this.error.set(null);
    this.payments.gateway
      .createRequest({
        methodId: v.methodId!,
        amount: Math.round(Number(v.amount) * 100) / 100,
        ...(discount > 0 ? { discount } : {}),
        ...(gate.required && gate.code ? { approvalCode: gate.code } : {}),
        description: v.description.trim() || null,
        validityDays: v.validityDays,
        customerName: v.customerName.trim() || null,
        customerPhone: v.customerPhone.replace(/[\s-]/g, '') || null,
        customerEmail: v.customerEmail.trim() || null,
        chatId: ctx?.chatId ?? null,
        customerId: ctx?.customerId ?? null,
      })
      .subscribe({
        next: (request) => {
          this.submitting.set(false);
          this.drafts.remove(this.approvalId);
          this.created.emit(request);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.approvalBox()?.handleSaveError(err);
          this.error.set(err?.message || this.t('common.loadFailed'));
        },
      });
  }

  private reset(ctx: PaymentRequestContext | null): void {
    this.form.reset({
      methodId: this.form.controls.methodId.value,
      amount: null,
      discount: null,
      description: '',
      validityDays: 14,
      customerName: ctx?.customerName ?? '',
      customerPhone: normalizePhone(ctx?.customerPhone ?? null),
      customerEmail: '',
    });
    this.error.set(null);
    this.submitting.set(false);
    this.approvalBox()?.reset();
    this.approvalId = null;
    this.loadMethods();
    this.prefillFromCustomer(ctx?.customerId ?? null);
    this.restore(ctx?.resumeApprovalId ?? null);
  }

  /** Puts back the values the discount request was made with. */
  private restore(approvalId: number | null): void {
    const draft = approvalId != null ? this.drafts.get(approvalId, 'PaymentRequest') : null;
    if (!draft) return;
    const d = draft.payload;
    this.approvalId = draft.approvalId;
    this.form.patchValue({
      ...(d.methodId != null ? { methodId: d.methodId } : {}),
      amount: d.amount,
      discount: d.discount,
      description: d.description,
      validityDays: d.validityDays,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerEmail: d.customerEmail,
    });
  }

  /** The box created a request — keep this form so the rep can close it and come back. */
  protected onApprovalRequested(approval: DiscountApproval): void {
    this.approvalId = approval.id;
    const v = this.form.getRawValue();
    this.drafts.save(approval.id, 'PaymentRequest', {
      chatId: this.context()?.chatId ?? null,
      methodId: v.methodId,
      amount: v.amount,
      discount: v.discount,
      description: v.description,
      validityDays: v.validityDays,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      customerEmail: v.customerEmail,
    });
  }

  /**
   * The chat may know only a name (Messenger has no phone) — the linked
   * customer record usually has phone + email. Fills a field only while it is
   * still empty and untouched, so nothing the user typed is overwritten.
   */
  private prefillFromCustomer(customerId: number | null): void {
    this.contactLookup?.unsubscribe();
    if (!customerId) return;
    this.contactLookup = this.payments
      .customerContact(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          const fill = (name: 'customerName' | 'customerPhone' | 'customerEmail', value: string | null) => {
            const control = this.form.controls[name];
            if (value && !control.value.trim() && !control.dirty) control.setValue(value);
          };
          fill('customerName', c.name);
          fill('customerPhone', normalizePhone(c.phone));
          fill('customerEmail', c.email);
        },
        error: () => undefined,
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
