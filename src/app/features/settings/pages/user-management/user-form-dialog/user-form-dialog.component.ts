import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
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
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';

type Mode = 'add' | 'edit';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  role: UserRole;
}

/**
 * Add / edit user modal — same form, two modes.
 *
 *   <app-user-form-dialog
 *      mode="add"
 *      (close)="reload()"
 *      (cancel)="dialogOpen = false">
 *   </app-user-form-dialog>
 *
 * The host component shows/hides via `*ngIf` and feeds the existing user
 * in edit mode through `[user]`.
 */
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.component.html',
  styleUrl: './user-form-dialog.component.scss',
})
export class UserFormDialogComponent {
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

  form: FormState = this.makeInitialState();

  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);

  ngOnChanges(): void {
    this.form = this.makeInitialState();
    this.errorMessage.set(null);
    this.submitting.set(false);
  }

  submit(ngForm: NgForm): void {
    if (this.submitting()) return;
    if (ngForm.invalid) return;

    this.errorMessage.set(null);
    this.submitting.set(true);

    if (this.mode === 'add') {
      const payload: AddUserRequest = {
        fullName: this.form.fullName.trim(),
        address: this.form.address.trim(),
        password: this.form.password,
        email: this.form.email.trim(),
        phoneNumber: this.form.phone.trim(),
        role: this.form.role,
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

    // Edit mode
    if (!this.user) return;
    const payload: UpdateUserRequest = {
      email: this.form.email.trim(),
      phone: this.form.phone.trim(),
      fullName: this.form.fullName.trim(),
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

  private makeInitialState(): FormState {
    if (this.mode === 'edit' && this.user) {
      return {
        fullName: this.user.fullName ?? '',
        email: this.user.email,
        phone: this.user.phone ?? '',
        address: '',
        password: '',
        role: 'Sales',
      };
    }
    return {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      password: '',
      role: 'Sales',
    };
  }

  /** Inline translation helper for toast messages. */
  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
