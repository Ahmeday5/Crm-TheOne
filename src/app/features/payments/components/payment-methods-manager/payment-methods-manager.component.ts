import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MockRibbonComponent } from '../../../../shared/components/mock-ribbon/mock-ribbon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentsService } from '../../data/payments.gateway';
import {
  PAYMENT_METHOD_TYPES,
  PaymentMethod,
  PaymentMethodInput,
  PaymentMethodType,
  isWallet,
} from '../../models/payments.models';
import { localMobile } from '../../utils/pay-links.util';
import { PaymentMethodLogoComponent } from '../payment-method-logo/payment-method-logo.component';

const WALLET_PHONE_RE = /^01[0125]\d{8}$/;
const IPA_RE = /^[A-Za-z0-9._-]+@instapay$/i;

/** Wallets need a number; InstaPay needs an IPA or a payment link. */
function methodRules(group: AbstractControl): ValidationErrors | null {
  const type = group.get('type')?.value as PaymentMethodType;
  const phone = localMobile(group.get('phoneNumber')?.value);
  const ipa = String(group.get('instapayAddress')?.value ?? '').trim();
  const link = String(group.get('instapayLink')?.value ?? '').trim();
  const errors: ValidationErrors = {};
  if (isWallet(type) && !WALLET_PHONE_RE.test(phone)) errors['walletPhone'] = true;
  if (!isWallet(type)) {
    if (phone && !WALLET_PHONE_RE.test(phone)) errors['walletPhone'] = true;
    if (!ipa && !link) errors['instapayTarget'] = true;
    if (ipa && !IPA_RE.test(ipa)) errors['ipa'] = true;
    if (link && !/^https:\/\/\S+$/i.test(link)) errors['link'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

/**
 * Admin: the accounts customers pay to (WhatsApp settings → "Payment methods").
 * Edits never touch links already sent — each request keeps a snapshot.
 */
@Component({
  selector: 'app-payment-methods-manager',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, MockRibbonComponent, PaymentMethodLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-methods-manager.component.html',
  styleUrl: './payment-methods-manager.component.scss',
})
export class PaymentMethodsManagerComponent implements OnInit {
  private readonly payments = inject(PaymentsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  protected readonly types = PAYMENT_METHOD_TYPES;
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);

  /** `null` = closed, `'new'` = add, else the method being edited. */
  protected readonly editing = signal<PaymentMethod | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      type: this.fb.nonNullable.control<PaymentMethodType>('VodafoneCash'),
      accountName: ['', [Validators.required, Validators.maxLength(120)]],
      phoneNumber: [''],
      instapayAddress: [''],
      instapayLink: [''],
      instructions: ['', Validators.maxLength(300)],
      isActive: [true],
      sortOrder: [0, [Validators.min(0), Validators.max(999)]],
    },
    { validators: methodRules },
  );

  private readonly typeValue = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });
  protected readonly isInstapay = computed(() => this.typeValue() === 'InstaPay');
  protected readonly modalTitle = computed(() =>
    this.editing() === 'new' ? 'payments.methods.addTitle' : 'payments.methods.editTitle',
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.payments.gateway.methods(true).subscribe({
      next: (list) => {
        this.methods.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected openAdd(): void {
    this.form.reset({
      type: 'VodafoneCash', accountName: '', phoneNumber: '', instapayAddress: '', instapayLink: '',
      instructions: '', isActive: true, sortOrder: this.methods().length,
    });
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(m: PaymentMethod): void {
    this.form.reset({
      type: m.type, accountName: m.accountName, phoneNumber: m.phoneNumber ?? '', instapayAddress: m.instapayAddress ?? '',
      instapayLink: m.instapayLink ?? '', instructions: m.instructions ?? '', isActive: m.isActive, sortOrder: m.sortOrder,
    });
    this.formError.set(null);
    this.editing.set(m);
  }

  protected closeForm(): void {
    if (!this.saving()) this.editing.set(null);
  }

  /** Group-level error shown under a field once the user touched it (or tried to save). */
  protected groupError(key: string, control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return this.form.hasError(key) && (c.touched || c.dirty);
  }

  protected save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const wallet = isWallet(v.type);
    const input: PaymentMethodInput = {
      type: v.type,
      accountName: v.accountName.trim(),
      phoneNumber: localMobile(v.phoneNumber) || null,
      instapayAddress: wallet ? null : v.instapayAddress.trim().toLowerCase() || null,
      instapayLink: wallet ? null : v.instapayLink.trim() || null,
      instructions: v.instructions.trim() || null,
      isActive: v.isActive,
      sortOrder: Number(v.sortOrder) || 0,
    };
    const current = this.editing();
    const request$ =
      current && current !== 'new'
        ? this.payments.gateway.updateMethod(current.id, input)
        : this.payments.gateway.createMethod(input);

    this.saving.set(true);
    this.formError.set(null);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success(this.t('payments.methods.saved'));
        this.load();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.formError.set(err?.message || this.t('common.loadFailed'));
      },
    });
  }

  protected toggleActive(m: PaymentMethod): void {
    const { id, currency, createdAt, updatedAt, ...rest } = m;
    this.payments.gateway.updateMethod(id, { ...rest, isActive: !m.isActive }).subscribe({
      next: () => this.load(),
      error: (err: ApiError) => this.toast.error(err?.message || this.t('common.loadFailed')),
    });
  }

  protected async remove(m: PaymentMethod): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('payments.methods.deleteTitle'),
      message: this.t('payments.methods.deleteMessage'),
      confirmText: this.t('common.delete'),
      cancelText: this.t('common.cancel'),
      type: 'danger',
    });
    if (!ok) return;
    this.payments.gateway.deleteMethod(m.id).subscribe({
      next: () => {
        this.toast.success(this.t('payments.methods.deleted'));
        this.load();
      },
      error: (err: ApiError) => this.toast.error(err?.message || this.t('common.loadFailed')),
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
