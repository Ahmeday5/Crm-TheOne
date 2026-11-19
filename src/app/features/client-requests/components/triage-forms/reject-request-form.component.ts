import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { REJECT_REASON_CODES, REJECT_REASON_MAX, RejectReasonCode } from '../../../client-portal/models/client-portal.models';
import { RejectRequestInput } from '../../models/client-requests.models';

/** Decline: a reason (one tap), an optional message (required for "other"), notify the client. */
@Component({
  selector: 'app-reject-request-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="tf" (ngSubmit)="submit()">
      <div class="tf-field">
        <span class="tf-label">{{ 'clientRequests.review.reasonCode' | translate }}</span>
        <div class="tf-chips" role="radiogroup" [attr.aria-label]="'clientRequests.review.reasonCode' | translate">
          @for (c of codes; track c) {
            <button type="button" role="radio" class="tf-chip" [class.is-active]="code() === c" [attr.aria-checked]="code() === c"
                    [disabled]="busy()" (click)="code.set(c)">{{ 'clientRequests.rejectReason.' + c | translate }}</button>
          }
        </div>
      </div>
      <label class="tf-field">
        <span class="tf-label">{{ 'clientRequests.review.reasonText' | translate }}
          <small>({{ (code() === 'Other' ? 'clientRequests.review.reasonTextRequired' : 'clientRequests.review.reasonTextOptional') | translate }})</small>
        </span>
        <textarea class="form-control form-control-sm" name="reason" rows="2" [maxlength]="reasonMax" [disabled]="busy()"
                  [placeholder]="'clientRequests.review.reasonPlaceholder' | translate"
                  [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
      </label>
      <label class="form-check tf-check">
        <input type="checkbox" class="form-check-input" name="notify" [disabled]="busy()" [ngModel]="notify()" (ngModelChange)="notify.set($event)" />
        <span class="form-check-label">{{ 'clientRequests.review.notifyClient' | translate }}</span>
      </label>
      <p class="tf-warn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>{{ 'clientRequests.review.rejectWarning' | translate }}</p>
      <div class="tf-actions">
        <button type="button" class="btn btn-light btn-sm" [disabled]="busy()" (click)="cancel.emit()">{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn btn-danger btn-sm" [disabled]="!canSend()">
          @if (busy()) { <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> }
          @else { <i class="fa-solid fa-ban me-1" aria-hidden="true"></i> }
          {{ 'clientRequests.review.confirmReject' | translate }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './triage-forms.scss',
})
export class RejectRequestFormComponent {
  readonly busy = input(false);
  readonly rejected = output<RejectRequestInput>();
  readonly cancel = output<void>();

  protected readonly codes = REJECT_REASON_CODES;
  protected readonly reasonMax = REJECT_REASON_MAX;
  protected readonly code = signal<RejectReasonCode | null>(null);
  protected readonly reason = signal('');
  protected readonly notify = signal(true);

  protected readonly canSend = computed(() => {
    const c = this.code();
    return !!c && (c !== 'Other' || !!this.reason().trim()) && !this.busy();
  });

  protected submit(): void {
    const c = this.code();
    if (!c || !this.canSend()) return;
    this.rejected.emit({ reasonCode: c, reason: this.reason().trim() || null, notifyClient: this.notify() });
  }
}
