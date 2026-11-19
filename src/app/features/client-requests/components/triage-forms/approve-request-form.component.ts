import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  REQUEST_PRIORITIES,
  REQUEST_TEXT_MAX,
  REQUEST_TITLE_MAX,
  RequestPriority,
  StaffOption,
} from '../../../client-portal/models/client-portal.models';
import { ApproveRequestInput } from '../../models/client-requests.models';

/**
 * Approve → the team: priority (one tap), optional assignee, optional note to
 * the developers and an optional clearer title. Dumb — the dialog sends.
 */
@Component({
  selector: 'app-approve-request-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="tf" (ngSubmit)="submit()">
      <div class="tf-field">
        <span class="tf-label">{{ 'clientRequests.review.priority' | translate }}</span>
        <div class="tf-seg" role="radiogroup" [attr.aria-label]="'clientRequests.review.priority' | translate">
          @for (p of priorities; track p) {
            <button type="button" role="radio" class="tf-seg__btn" [attr.data-priority]="p" [class.is-active]="priority() === p"
                    [attr.aria-checked]="priority() === p" [disabled]="busy()" (click)="pick(p)">
              {{ 'clientPortal.priority.' + p | translate }}
            </button>
          }
        </div>
      </div>

      <div class="tf-row">
        <label class="tf-field">
          <span class="tf-label">{{ 'clientRequests.review.assignee' | translate }}</span>
          <select class="form-select form-select-sm" name="assignee" [disabled]="busy()" [ngModel]="assignee()" (ngModelChange)="assignee.set($event)">
            <option value="">{{ 'clientRequests.review.unassigned' | translate }}</option>
            @for (a of assignees(); track a.userId) { <option [value]="a.userId">{{ a.fullName }}</option> }
          </select>
        </label>
        <label class="tf-field">
          <span class="tf-label">{{ 'clientRequests.review.rewriteTitle' | translate }} <small>({{ 'clientRequests.picker.optional' | translate }})</small></span>
          <input type="text" class="form-control form-control-sm" name="title" [maxlength]="titleMax" [disabled]="busy()"
                 [placeholder]="currentTitle()" [ngModel]="title()" (ngModelChange)="title.set($event)" />
        </label>
      </div>

      <label class="tf-field">
        <span class="tf-label"><i class="fa-solid fa-lock me-1" aria-hidden="true"></i>{{ 'clientRequests.review.noteToTeam' | translate }} <small>({{ 'clientRequests.picker.optional' | translate }})</small></span>
        <textarea class="form-control form-control-sm tf-internal" name="note" rows="2" [maxlength]="textMax" [disabled]="busy()"
                  [placeholder]="'clientRequests.review.notePlaceholder' | translate" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
      </label>

      <div class="tf-actions">
        <button type="button" class="btn btn-light btn-sm" [disabled]="busy()" (click)="cancel.emit()">{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn btn-success btn-sm" [disabled]="busy()">
          @if (busy()) { <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> }
          @else { <i class="fa-solid fa-check me-1" aria-hidden="true"></i> }
          {{ 'clientRequests.review.confirmApprove' | translate }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './triage-forms.scss',
})
export class ApproveRequestFormComponent {
  readonly assignees = input<StaffOption[]>([]);
  readonly currentTitle = input('');
  /** Prefill from the client's own type (issues lean "High"). */
  readonly suggestedPriority = input<RequestPriority>('Medium');
  readonly busy = input(false);

  readonly approved = output<ApproveRequestInput>();
  readonly cancel = output<void>();

  protected readonly priorities = REQUEST_PRIORITIES;
  protected readonly titleMax = REQUEST_TITLE_MAX;
  protected readonly textMax = REQUEST_TEXT_MAX;

  /** The Admin's pick — until then the suggestion stands. */
  private readonly picked = signal<RequestPriority | null>(null);
  protected readonly priority = computed(() => this.picked() ?? this.suggestedPriority());

  protected readonly assignee = signal('');
  protected readonly title = signal('');
  protected readonly note = signal('');

  protected pick(p: RequestPriority): void {
    this.picked.set(p);
  }

  protected submit(): void {
    if (this.busy()) return;
    this.approved.emit({
      priority: this.priority(),
      assignedToId: this.assignee() || null,
      internalNote: this.note().trim() || null,
      title: this.title().trim() || null,
    });
  }
}
