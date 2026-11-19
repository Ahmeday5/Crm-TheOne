import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, filter, of } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RequestTargetChipComponent } from '../../../client-portal/components/request-target-chip/request-target-chip.component';
import { RequestThreadComponent, ThreadReply } from '../../../client-portal/components/request-thread/request-thread.component';
import {
  ClientRequestDetails,
  RequestOptions,
  RequestPriority,
  StaffOption,
  isAwaitingDecision,
} from '../../../client-portal/models/client-portal.models';
import { requestStatusClass, requestTypeIcon } from '../../../client-portal/utils/client-portal-ui.util';
import { UiError, errorText, isConflict, toUiError } from '../../../client-portal/utils/request-errors.util';
import { PROJECT_SURFACES_GATEWAY } from '../../data/project-surfaces.gateway';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../../data/staff-client-requests.gateway';
import { ApproveRequestInput, ClassificationPatch, RejectRequestInput } from '../../models/client-requests.models';
import { RequestAssigneesService } from '../../services/request-assignees.service';
import { ClientRequestsInboxStore } from '../../state/client-requests-inbox.store';
import { ApproveRequestFormComponent } from '../triage-forms/approve-request-form.component';
import { ClarifyInput, ClarifyRequestFormComponent } from '../triage-forms/clarify-request-form.component';
import { ClassificationFormComponent } from '../triage-forms/classification-form.component';
import { RejectRequestFormComponent } from '../triage-forms/reject-request-form.component';

type Mode = 'approve' | 'ask' | 'reject' | 'classify' | null;
type BannerKind = 'pending' | 'replied' | 'waitingClient' | 'rejected' | null;

/**
 * The Admin's review of one client request — everything needed to decide on
 * one screen: what it's about (re-file it if the client picked wrong), who
 * sent it, the conversation, and three clear actions: approve → team,
 * ask the client, decline. Each action opens its own short form in place.
 */
@Component({
  selector: 'app-request-review-dialog',
  standalone: true,
  imports: [
    RouterLink,
    ModalComponent,
    TranslatePipe,
    CairoDatePipe,
    TimeAgoPipe,
    RequestTargetChipComponent,
    RequestThreadComponent,
    ApproveRequestFormComponent,
    ClarifyRequestFormComponent,
    RejectRequestFormComponent,
    ClassificationFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-review-dialog.component.html',
  styleUrl: './request-review-dialog.component.scss',
})
export class RequestReviewDialogComponent {
  private readonly api = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly surfacesApi = inject(PROJECT_SURFACES_GATEWAY);
  private readonly assigneesApi = inject(RequestAssigneesService);
  private readonly inbox = inject(ClientRequestsInboxStore);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<number>();
  /** The request changed — refresh the row it came from. */
  readonly updated = output<ClientRequestDetails>();
  readonly closed = output<void>();

  protected readonly request = signal<ClientRequestDetails | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly mode = signal<Mode>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<UiError | null>(null);
  protected readonly assignees = signal<StaffOption[]>([]);
  protected readonly options = signal<RequestOptions | null>(null);

  protected readonly sending = signal(false);
  protected readonly sentCount = signal(0);
  protected readonly replyError = signal<string | null>(null);

  protected readonly typeIcon = requestTypeIcon;
  protected readonly statusClass = requestStatusClass;

  protected readonly canDecide = computed(() => {
    const r = this.request();
    return !!r && isAwaitingDecision(r.status);
  });
  protected readonly banner = computed<BannerKind>(() => {
    const r = this.request();
    if (!r) return null;
    if (r.status === 'Rejected') return 'rejected';
    if (r.status === 'NeedsClarification') return 'waitingClient';
    if (r.status === 'PendingReview') {
      const answered = !!r.clientRepliedAt && (!r.clarificationRequestedAt || r.clientRepliedAt > r.clarificationRequestedAt);
      return answered && r.clarificationRequestedAt ? 'replied' : 'pending';
    }
    return null;
  });
  /** Issues default to "High" — they usually block someone. */
  protected readonly suggestedPriority = computed<RequestPriority>(() => (this.request()?.type === 'Issue' ? 'High' : 'Medium'));

  ngOnInit(): void {
    this.load();
    // Someone else (the client answering, another Admin) changed it → refresh quietly.
    this.inbox.changed$
      .pipe(
        filter((pid) => pid === null || pid === this.request()?.projectId),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.busy() && !this.sending()) this.load(true);
      });
  }

  protected load(quiet = false): void {
    if (!quiet) this.loadFailed.set(false);
    this.api.detail(this.requestId()).subscribe({
      next: (r) => {
        const first = !this.request();
        this.request.set(r);
        if (first) this.loadProjectData(r.projectId);
      },
      error: () => {
        if (!quiet) this.loadFailed.set(true);
      },
    });
  }

  protected setMode(mode: Mode): void {
    this.error.set(null);
    this.mode.set(this.mode() === mode ? null : mode);
  }

  protected approve(input: ApproveRequestInput): void {
    this.run(this.api.approve(this.requestId(), input), 'approved');
  }

  protected ask(input: ClarifyInput): void {
    this.run(this.api.clarify(this.requestId(), input.question, input.attachments), 'asked');
  }

  protected reject(input: RejectRequestInput): void {
    this.run(this.api.reject(this.requestId(), input), 'rejected');
  }

  protected reopen(): void {
    this.run(this.api.reopenReview(this.requestId()), 'reopened');
  }

  protected classify(patch: ClassificationPatch): void {
    this.run(this.api.classify(this.requestId(), patch), 'classified');
  }

  protected onReply(reply: ThreadReply): void {
    const r = this.request();
    if (!r) return;
    this.sending.set(true);
    this.replyError.set(null);
    this.api.adminComment(r.id, reply.body, reply.attachments, reply.isInternal).subscribe({
      next: (comment) => {
        this.sending.set(false);
        const next = {
          ...r,
          comments: [...r.comments, comment],
          commentsCount: r.commentsCount + 1,
        };
        this.request.set(next);
        this.sentCount.update((n) => n + 1);
        this.updated.emit(next);
      },
      error: (e: ApiError) => {
        this.sending.set(false);
        this.replyError.set(errorText(e, this.lang.lang()));
      },
    });
  }

  private run(action$: Observable<ClientRequestDetails>, done: 'approved' | 'asked' | 'rejected' | 'reopened' | 'classified'): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    action$.subscribe({
      next: (fresh) => {
        this.busy.set(false);
        this.mode.set(null);
        this.request.set(fresh);
        this.updated.emit(fresh);
        this.inbox.refresh();
        this.toast.success(resolveKey(TRANSLATIONS[this.lang.lang()], `clientRequests.review.done.${done}`));
      },
      error: (e: ApiError) => {
        this.busy.set(false);
        this.error.set(toUiError(e));
        // Someone else already acted — show the truth.
        if (isConflict(e)) {
          this.mode.set(null);
          this.load(true);
        }
      },
    });
  }

  private loadProjectData(projectId: number): void {
    this.assigneesApi.forProject(projectId).subscribe((list) => this.assignees.set(list));
    this.surfacesApi
      .list(projectId)
      .pipe(catchError(() => of([])))
      .subscribe((surfaces) => this.options.set({ surfaces: surfaces.filter((s) => s.isActive), appRequired: false }));
  }
}
