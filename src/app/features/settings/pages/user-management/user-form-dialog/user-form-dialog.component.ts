import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
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
export class UserFormDialogComponent implements OnChanges, OnInit {
  @Input({ required: true }) mode!: Mode;
  /** Required in edit mode. */
  @Input() user: AppUser | null = null;

  /** Emitted after a successful add/update — host should reload the list. */
  @Output() close = new EventEmitter<void>();
  /** User cancelled / clicked the backdrop. */
  @Output() cancel = new EventEmitter<void>();

  /** Roles from the API, falling back to the bundled list until they load. */
  private readonly apiRoles = signal<string[]>([]);
  readonly roles = computed<string[]>(() => {
    const fromApi = this.apiRoles();
    return fromApi.length ? fromApi : [...ALL_ROLES];
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);

  /**
   * Reactive form. `password` is add-only; `role` / `address` / `specialty` now
   * apply to both add and edit (the update endpoint accepts them). Validators
   * that only apply in add mode are toggled in `ngOnChanges`.
   */
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(6)]],
    role: ['Sales' as string, [Validators.required]],
    address: ['', [Validators.required]],
    specialty: [''],
    password: [''],
  });

  ngOnInit(): void {
    this.users.roles().subscribe({
      next: (roles) => this.apiRoles.set(roles ?? []),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'user' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);

      this.form.reset({
        fullName: this.user?.fullName ?? '',
        email: this.user?.email ?? '',
        phone: this.user?.phone ?? '',
        role: (this.user?.role as string) || 'Sales',
        address: this.user?.address ?? '',
        specialty: this.user?.specialty ?? '',
        password: '',
      });

      // Password is required only when creating.
      const passwordC = this.form.controls.password;
      if (this.mode === 'add') {
        passwordC.setValidators([Validators.required, Validators.minLength(6)]);
      } else {
        passwordC.clearValidators();
      }
      passwordC.updateValueAndValidity({ emitEvent: false });
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
        specialty: v.specialty.trim(),
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
      role: v.role,
      address: v.address.trim(),
      specialty: v.specialty.trim(),
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
