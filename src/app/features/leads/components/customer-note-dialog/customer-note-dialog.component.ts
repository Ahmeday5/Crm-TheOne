import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  CustomerNoteResponse,
  CustomerNoteRole,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

/** Cap matches the backend column — keeps the textarea honest. */
const NOTE_MAX_LENGTH = 1000;

/**
 * Maps the active app role to the customer-note slot it can edit.
 * Returns `null` for roles that don't own a slot (Admin/Developer).
 */
function noteRoleForUser(role: string | null): CustomerNoteRole | null {
  switch (role) {
    case 'Marketing':
      return 'Marketing';
    case 'Sales':
      return 'Sales';
    case 'Support':
      return 'Support';
    default:
      return null;
  }
}

/**
 * Reusable dialog for the per-role note slot on a customer.
 *
 * Visibility:
 *   - All three slots (marketing / sales / support) are shown read-only so the
 *     team can see the full conversation.
 *   - Only the slot matching the caller's role is editable.
 *   - Backend rejects (400) when the caller isn't the current assignee — the
 *     human-readable message comes back via `ApiError.message`, so we just
 *     surface it inline + toast.
 */
@Component({
  selector: 'app-customer-note-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-note-dialog.component.html',
})
export class CustomerNoteDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';
  @Input() noteMarketing: string | null = null;
  @Input() noteSales: string | null = null;
  @Input() noteSupport: string | null = null;

  @Output() saved = new EventEmitter<CustomerNoteResponse>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly maxLength = NOTE_MAX_LENGTH;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Editable buffer for the caller's slot. */
  readonly draft = signal('');

  /** Snapshot of the original value so we can detect "no change". */
  private originalValue = '';

  /** Resolved once on init from the auth signal — drives which slot is editable. */
  readonly editableRole = signal<CustomerNoteRole | null>(null);

  /** Localised label for the active editor's role. */
  readonly editableRoleLabelKey = computed(() => {
    const r = this.editableRole();
    return r ? `customers.noteModal.roles.${r.toLowerCase()}` : null;
  });

  /** True when the user has a role that owns a slot AND they actually changed it. */
  readonly canSubmit = computed(() => {
    if (!this.editableRole()) return false;
    if (this.submitting()) return false;
    const draft = this.draft().trim();
    if (!draft) return false;
    return draft !== this.originalValue.trim();
  });

  ngOnInit(): void {
    const role = noteRoleForUser(this.auth.currentRole());
    this.editableRole.set(role);

    const initial = this.currentSlotValue(role) ?? '';
    this.originalValue = initial;
    this.draft.set(initial);
  }

  onDraftChange(value: string): void {
    this.draft.set(value);
    if (this.errorMessage()) this.errorMessage.set(null);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.saveMyNote(this.customerId, this.draft()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.noteModal.success'));
        this.saved.emit(res);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.noteModal.failed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  /** Read-only labels used by the template for the non-editable slots. */
  slotLabelKey(role: CustomerNoteRole): string {
    return `customers.noteModal.roles.${role.toLowerCase()}`;
  }

  slotValue(role: CustomerNoteRole): string {
    return this.currentSlotValue(role) ?? '';
  }

  private currentSlotValue(role: CustomerNoteRole | null): string | null {
    switch (role) {
      case 'Marketing':
        return this.noteMarketing;
      case 'Sales':
        return this.noteSales;
      case 'Support':
        return this.noteSupport;
      default:
        return null;
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
