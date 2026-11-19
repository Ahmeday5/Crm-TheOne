import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientRequestListItem, RequestStatus } from '../../models/client-portal.models';
import { requestStatusIcon, requestStatusTone } from '../../utils/client-portal-ui.util';

type StepState = 'done' | 'current' | 'todo' | 'failed';

interface JourneyStep {
  key: 'received' | 'review' | 'work' | 'done';
  state: StepState;
}

/**
 * Where my request is, for the client: a 4-step journey
 * (received → management review → in progress → done) and one plain-language
 * card saying what happens next. While the team waits for the client, the
 * card carries the "answer the question" action.
 */
@Component({
  selector: 'app-request-status-banner',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = request();
    <ol class="rsb-journey" [attr.aria-label]="'clientPortal.staff.status' | translate">
      @for (s of journey(); track s.key; let last = $last) {
        <li class="rsb-step" [attr.data-state]="s.state">
          <span class="rsb-step__dot">
            @switch (s.state) {
              @case ('done') { <i class="fa-solid fa-check" aria-hidden="true"></i> }
              @case ('failed') { <i class="fa-solid fa-xmark" aria-hidden="true"></i> }
              @case ('current') { <span class="rsb-step__pulse" aria-hidden="true"></span> }
            }
          </span>
          <span class="rsb-step__label">{{ 'clientRequests.journey.' + s.key | translate }}</span>
        </li>
        @if (!last) { <li class="rsb-line" [attr.data-state]="s.state" aria-hidden="true"></li> }
      }
    </ol>

    <div class="rsb-card" [attr.data-tone]="tone()" role="status">
      <span class="rsb-card__icon"><i [class]="icon()" aria-hidden="true"></i></span>
      <div class="rsb-card__text">
        <strong>{{ 'clientRequests.clientStatus.' + r.status + '.title' | translate }}</strong>
        <p>{{ 'clientRequests.clientStatus.' + r.status + '.text' | translate }}</p>
        @if (r.status === 'Rejected' && (r.rejectReasonCode || r.rejectReason)) {
          <div class="rsb-reason">
            <span>{{ 'clientRequests.clientStatus.Rejected.reason' | translate }}:</span>
            @if (r.rejectReasonCode) { <b>{{ 'clientRequests.rejectReason.' + r.rejectReasonCode | translate }}</b> }
            @if (r.rejectReason) { <p>{{ r.rejectReason }}</p> }
          </div>
        }
      </div>
      @if (r.status === 'NeedsClarification') {
        <button type="button" class="btn btn-danger btn-sm rsb-card__cta" (click)="answer.emit()">
          <i class="fa-solid fa-reply me-1" aria-hidden="true"></i>{{ 'clientRequests.clientStatus.NeedsClarification.cta' | translate }}
        </button>
      }
    </div>
  `,
  styleUrl: './request-status-banner.component.scss',
})
export class RequestStatusBannerComponent {
  readonly request = input.required<Pick<ClientRequestListItem, 'status' | 'rejectReasonCode' | 'rejectReason'>>();
  /** "Answer the question" — the page focuses the reply box. */
  readonly answer = output<void>();

  protected readonly tone = computed(() => requestStatusTone(this.request().status));
  protected readonly icon = computed(() => requestStatusIcon(this.request().status));
  protected readonly journey = computed(() => journeyOf(this.request().status));
}

function journeyOf(status: RequestStatus): JourneyStep[] {
  const review: StepState =
    status === 'Rejected' ? 'failed' : status === 'PendingReview' || status === 'NeedsClarification' ? 'current' : 'done';
  const work: StepState =
    status === 'Open' || status === 'InReview' || status === 'InProgress'
      ? 'current'
      : status === 'Resolved' || status === 'Closed'
        ? 'done'
        : 'todo';
  const done: StepState = status === 'Resolved' || status === 'Closed' ? 'done' : 'todo';
  return [
    { key: 'received', state: 'done' },
    { key: 'review', state: review },
    { key: 'work', state: work },
    { key: 'done', state: done },
  ];
}
