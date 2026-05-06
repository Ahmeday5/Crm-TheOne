import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ALL_ROLES } from '../../../../../core/constants/roles.const';
import { TRANSLATIONS, resolveKey } from '../../../../../core/i18n';
import { ApiError } from '../../../../../core/models/api-response.model';
import { UserRole } from '../../../../../core/models/auth.model';
import {
  AddUserRequest,
  AppUser,
  UpdateUserRequest,
} from '../../../../../core/models/user.model';
import { LanguageService } from '../../../../../core/services/language.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { UsersService } from '../../../../../core/services/users.service';
import { FormErrorComponent } from '../../../../../shared/components/form-error/form-error.component';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';

type Mode = 'add' | 'edit';

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.component.html',
  styleUrl: './user-form-dialog.component.scss',
})
export class UserFormDialogComponent implements OnChanges {
  @Input({ required: true }) mode!: Mode;
  /** Required in edit mode. */
  @Input() user: AppUser | null = null;

  /** Emitted after a successful add/update — host should reload the list. */
  @Output() close = new EventEmitter<void>();
  /** User cancelled / clicked the backdrop. */
  @Output() cancel = new EventEmitter<void>();

  readonly roles: ReadonlyArray<UserRole> = ALL_ROLES;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);

  /**
   * Reactive form. The "add"-only fields (`address`, `password`, `role`) are
   * always declared so we can validate them; their `required` validators only
   * fire when the form is in add mode (we toggle it in `ngOnChanges`).
   */
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(6)]],
    address: [''],
    password: [''],
    role: ['Sales' as UserRole],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'user' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);

      this.form.reset({
        fullName: this.user?.fullName ?? '',
        email: this.user?.email ?? '',
        phone: this.user?.phone ?? '',
        address: '',
        password: '',
        role: 'Sales',
      });

      // Add-only validators
      const addressC = this.form.controls.address;
      const passwordC = this.form.controls.password;
      const roleC = this.form.controls.role;
      if (this.mode === 'add') {
        addressC.setValidators([Validators.required]);
        passwordC.setValidators([Validators.required, Validators.minLength(6)]);
        roleC.setValidators([Validators.required]);
      } else {
        addressC.clearValidators();
        passwordC.clearValidators();
        roleC.clearValidators();
      }
      addressC.updateValueAndValidity({ emitEvent: false });
      passwordC.updateValueAndValidity({ emitEvent: false });
      roleC.updateValueAndValidity({ emitEvent: false });
    }
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    if (this.mode === 'add') {
      const v = this.form.getRawValue();
      const payload: AddUserRequest = {
        fullName: v.fullName.trim(),
        address: v.address.trim(),
        password: v.password,
        email: v.email.trim(),
        phoneNumber: v.phone.trim(),
        role: v.role,
      };
      this.users.add(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(this.t('settings.users.messages.added'));
          this.close.emit();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message ?? null);
        },
      });
      return;
    }

    if (!this.user) return;
    const v = this.form.getRawValue();
    const payload: UpdateUserRequest = {
      email: v.email.trim(),
      phone: v.phone.trim(),
      fullName: v.fullName.trim(),
    };
    this.users.update(this.user.userId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('settings.users.messages.updated'));
        this.close.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  onBackdropClick(): void {
    if (this.submitting()) return;
    this.cancel.emit();
  }

  isInvalid(ctrl: AbstractControl): boolean {
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  /** Inline translation helper. */
  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
