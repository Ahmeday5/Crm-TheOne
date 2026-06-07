import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ContactResult, CustomerFollowUpResponse } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

interface ResultOption {
  value: ContactResult;
  icon: string;
  iconClass: string;
}

const RESULT_OPTIONS: ResultOption[] = [
  { value: 'Answered',    icon: 'fa-solid fa-phone',                iconClass: 'text-success' },
  { value: 'NoAnswer',    icon: 'fa-solid fa-phone-slash',          iconClass: 'text-danger'  },
  { value: 'Busy',        icon: 'fa-solid fa-phone-volume',         iconClass: 'text-warning' },
  { value: 'WrongNumber', icon: 'fa-solid fa-triangle-exclamation', iconClass: 'text-secondary' },
];

@Component({
  selector: 'app-log-contact-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './log-contact-dialog.component.html',
})
export class LogContactDialogComponent {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';

  @Output() logged = new EventEmitter<CustomerFollowUpResponse>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly RESULT_OPTIONS = RESULT_OPTIONS;

  readonly selectedResult = signal<ContactResult | null>(null);
  readonly notes = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canSubmit = computed(() => !this.submitting() && this.selectedResult() !== null);

  onSelect(result: ContactResult): void {
    this.selectedResult.set(result);
    this.errorMessage.set(null);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const result = this.selectedResult();
    if (!result) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    const trimmedNotes = this.notes().trim();
    this.customers
      .logContactAttempt(this.customerId, {
        result,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('customers.contactModal.success'));
          this.logged.emit(res);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const message = err?.message?.trim() || this.t('customers.contactModal.failed');
          this.errorMessage.set(message);
          this.toast.error(message);
        },
      });
  }

  resultLabel(result: ContactResult): string {
    return this.t(`customers.contactModal.results.${result}`);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
