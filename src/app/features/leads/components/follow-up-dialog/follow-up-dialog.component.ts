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
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CustomerFollowUpResponse } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

/**
 * Converts an ISO timestamp into the `YYYY-MM-DDTHH:mm` shape that
 * `<input type="datetime-local">` requires. Returns '' for null inputs.
 */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : '';
}

/** Converts the datetime-local string back to a UTC ISO. */
function localInputToIso(local: string): string {
  if (!local) return new Date().toISOString();
  // `new Date(local)` interprets the value as local time, then toISOString
  // converts to UTC — matching the backend's `…Z` shape.
  const dt = new Date(local);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

@Component({
  selector: 'app-follow-up-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './follow-up-dialog.component.html',
})
export class FollowUpDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';
  @Input() lastFollowUpDate: string | null = null;
  @Input() nextFollowUpDate: string | null = null;

  @Output() updated = new EventEmitter<CustomerFollowUpResponse>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Bound to datetime-local inputs. */
  readonly lastInput = signal('');
  readonly nextInput = signal('');

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (!this.lastInput() || !this.nextInput()) return false;
    const last = new Date(this.lastInput()).getTime();
    const next = new Date(this.nextInput()).getTime();
    if (Number.isNaN(last) || Number.isNaN(next)) return false;
    // Next must come after last — common-sense guardrail.
    return next > last;
  });

  ngOnInit(): void {
    this.lastInput.set(isoToLocalInput(this.lastFollowUpDate) || isoToLocalInput(new Date().toISOString()));
    this.nextInput.set(
      isoToLocalInput(this.nextFollowUpDate) ||
        isoToLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
    );
  }

  onLastChange(v: string): void {
    this.lastInput.set(v);
    this.errorMessage.set(null);
  }

  onNextChange(v: string): void {
    this.nextInput.set(v);
    this.errorMessage.set(null);
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.errorMessage.set(this.t('customers.followUpModal.invalidRange'));
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers
      .updateFollowUp(this.customerId, {
        lastFollowUpDate: localInputToIso(this.lastInput()),
        nextFollowUpDate: localInputToIso(this.nextInput()),
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('customers.followUpModal.success'));
          this.updated.emit(res);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const message =
            err?.message?.trim() || this.t('customers.followUpModal.failed');
          this.errorMessage.set(message);
          this.toast.error(message);
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
