import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, map, startWith } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  SearchableSelectComponent,
  SelectFetchParams,
  SelectPageResult,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { noWhitespaceValidator } from '../../../../shared/utils/custom-validators.util';
import { VAULT_LIMITS, VAULT_TYPES, VaultAccount, VaultAccountType } from '../../models/vault.models';
import { VaultService } from '../../services/vault.service';
import {
  VaultFormValue,
  buildVaultInput,
  hostValidator,
  passwordIntent,
  portValidator,
  requiredFieldsFor,
  urlValidator,
} from '../../utils/vault-form.util';

const GENERATED_LENGTH = 20;
const GENERATOR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';

/**
 * Add / edit a vault account. The type switch decides what is required
 * (Email → email; Server → host). On edit the password field starts empty:
 * leave it to keep the stored one, type to replace it, or use "clear
 * password" to remove it — see `passwordIntent`.
 */
@Component({
  selector: 'app-vault-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vault-form-dialog.component.html',
  styleUrl: './vault-form-dialog.component.scss',
})
export class VaultFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vault = inject(VaultService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** `null` → create. */
  readonly accountId = input<number | null>(null);
  /** Pre-selected type for a new account (from the active tab). */
  readonly initialType = input<VaultAccountType>('Email');
  readonly saved = output<VaultAccount>();
  readonly cancel = output<void>();

  protected readonly types = VAULT_TYPES;
  protected readonly limits = VAULT_LIMITS;
  protected readonly mode = computed(() => (this.accountId() ? 'edit' : 'create'));

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  /** Edit: the stored account has a password. */
  protected readonly hadPassword = signal(false);
  /** Edit: "clear password" was pressed. */
  protected readonly removePassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<VaultAccountType>('Email'),
    title: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(VAULT_LIMITS.title)]],
    email: ['', [Validators.email, Validators.maxLength(VAULT_LIMITS.email)]],
    host: ['', [hostValidator, Validators.maxLength(VAULT_LIMITS.host)]],
    port: this.fb.control<number | string | null>(null, [portValidator]),
    username: ['', [Validators.maxLength(VAULT_LIMITS.username)]],
    password: ['', [Validators.maxLength(VAULT_LIMITS.password)]],
    url: ['', [urlValidator, Validators.maxLength(VAULT_LIMITS.url)]],
    notes: ['', [Validators.maxLength(VAULT_LIMITS.notes)]],
    customerId: this.fb.control<number | null>(null),
    projectId: this.fb.control<number | null>(null),
  });

  protected readonly type = toSignal(this.form.controls.type.valueChanges.pipe(startWith(this.form.controls.type.value)), {
    initialValue: this.form.controls.type.value,
  });
  protected readonly required = computed(() => requiredFieldsFor(this.type()));

  /** Messages for the vault-specific validators (`app-form-error [custom]`). */
  protected readonly customErrors = computed(() => {
    this.language.lang();
    return {
      host: () => this.t('vault.form.errors.host'),
      url: () => this.t('vault.form.errors.url'),
      port: () => this.t('vault.form.errors.port'),
    };
  });

  protected readonly customersFetch = (): Observable<Record<string, unknown>[]> =>
    this.vault.customerOptions() as unknown as Observable<Record<string, unknown>[]>;

  protected readonly projectsFetch = (params: SelectFetchParams): Observable<SelectPageResult> =>
    this.vault.projectsPage(params).pipe(
      map((page) => ({ count: page?.count ?? 0, data: (page?.data ?? []) as unknown as Record<string, unknown>[] })),
    );

  ngOnInit(): void {
    this.form.controls.type.valueChanges
      .pipe(startWith(this.form.controls.type.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.applyTypeRules(type));

    // Typing a new password cancels a pending "clear".
    this.form.controls.password.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (value) this.removePassword.set(false);
    });

    const id = this.accountId();
    if (id) this.load(id);
    else this.form.controls.type.setValue(this.initialType());
  }

  protected load(id = this.accountId()): void {
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.vault.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.form.reset({
          type: a.type,
          title: a.title ?? '',
          email: a.email ?? '',
          host: a.host ?? '',
          port: a.port ?? null,
          username: a.username ?? '',
          password: '',
          url: a.url ?? '',
          notes: a.notes ?? '',
          customerId: a.customerId ?? null,
          projectId: a.projectId ?? null,
        });
        this.hadPassword.set(a.hasPassword);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.loadError.set(err?.message?.trim() || this.t('vault.messages.loadOneFailed'));
      },
    });
  }

  protected setType(type: VaultAccountType): void {
    if (this.form.controls.type.value !== type) this.form.controls.type.setValue(type);
  }

  protected toggleRemovePassword(): void {
    const next = !this.removePassword();
    this.removePassword.set(next);
    if (next) this.form.controls.password.setValue('', { emitEvent: false });
  }

  /** Cryptographically random, unambiguous characters. */
  protected generatePassword(): void {
    const bytes = new Uint32Array(GENERATED_LENGTH);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, (b) => GENERATOR_ALPHABET[b % GENERATOR_ALPHABET.length]).join('');
    this.form.controls.password.setValue(password);
    this.form.controls.password.markAsDirty();
    this.showPassword.set(true);
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const intent = passwordIntent(this.mode(), value.password, this.removePassword());
    const input = buildVaultInput(value, intent);
    const id = this.accountId();

    this.submitting.set(true);
    this.errorMessage.set(null);
    (id ? this.vault.update(id, input) : this.vault.create(input))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.submitting.set(false);
          this.form.controls.password.setValue('', { emitEvent: false });
          this.saved.emit(account);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message?.trim() || this.t('vault.messages.saveFailed'));
        },
      });
  }

  protected invalid(name: keyof VaultFormValue): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched || this.submitAttempted());
  }

  private applyTypeRules(type: VaultAccountType): void {
    const req = requiredFieldsFor(type);
    const { email, host } = this.form.controls;
    email.setValidators(req.email ? [Validators.required, Validators.email, Validators.maxLength(VAULT_LIMITS.email)] : [Validators.email, Validators.maxLength(VAULT_LIMITS.email)]);
    host.setValidators(req.host ? [Validators.required, hostValidator, Validators.maxLength(VAULT_LIMITS.host)] : [hostValidator, Validators.maxLength(VAULT_LIMITS.host)]);
    email.updateValueAndValidity({ emitEvent: false });
    host.updateValueAndValidity({ emitEvent: false });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
