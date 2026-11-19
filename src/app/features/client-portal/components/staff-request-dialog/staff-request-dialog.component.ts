import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../../../client-requests/data/staff-client-requests.gateway';
import { RequestAssigneesService } from '../../../client-requests/services/request-assignees.service';
import {
  ClientRequestDetails,
  REQUEST_PRIORITIES,
  RequestPatch,
  StaffOption,
  TEAM_STATUSES,
  canMoveStatus,
} from '../../models/client-portal.models';
import { ToastService } from '../../../../core/services/toast.service';
import { requestTypeIcon } from '../../utils/client-portal-ui.util';
import { errorText } from '../../utils/request-errors.util';
import { RequestTargetChipComponent } from '../request-target-chip/request-target-chip.component';
import { RequestThreadComponent, ThreadReply } from '../request-thread/request-thread.component';

/**
 * One APPROVED client request, staff side (the team flow): status / priority /
 * assignee at the top, the conversation below (with internal notes). Every
 * change is saved immediately. Triage (approve / ask / decline) lives in
 * `RequestReviewDialogComponent`.
 */
@Component({
  selector: 'app-staff-request-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe, CairoDatePipe, RequestThreadComponent, RequestTargetChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-request-dialog.component.html',
  styleUrl: './staff-request-dialog.component.scss',
})
export class StaffRequestDialogComponent {
  private readonly api = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly assigneesApi = inject(RequestAssigneesService);
  private readonly lang = inject(LanguageService);
  private readonly toast = inject(ToastService);

  readonly projectId = input.required<number>();
  readonly requestId = input.required<number>();
  readonly isAdmin = input(false);
  readonly assignees = input<StaffOption[]>([]);

  /** The request changed (status, priority, assignee, new reply) — refresh the list row. */
  readonly updated = output<ClientRequestDetails>();
  readonly closed = output<void>();

  protected readonly statuses = TEAM_STATUSES;
  /** Earlier stages are disabled in the picker — statuses only move forward. */
  protected readonly canMove = canMoveStatus;
  /** Given by the parent, else fetched for the project (Admin only). */
  protected readonly assigneeOptions = signal<StaffOption[]>([]);
  protected readonly priorities = REQUEST_PRIORITIES;
  protected readonly typeIcon = requestTypeIcon;

  protected readonly request = signal<ClientRequestDetails | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly sending = signal(false);
  protected readonly sentCount = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly replyError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    if (this.assignees().length) this.assigneeOptions.set(this.assignees());
    else if (this.isAdmin()) this.assigneesApi.forProject(this.projectId()).subscribe((list) => this.assigneeOptions.set(list));
  }

  protected load(): void {
    this.loadFailed.set(false);
    this.api.get(this.projectId(), this.requestId()).subscribe({
      next: (r) => this.request.set(r),
      error: () => this.loadFailed.set(true),
    });
  }

  /** The current assignee is in the picker (else it's shown as an extra option). */
  protected isKnownAssignee(userId: string): boolean {
    return this.assigneeOptions().some((a) => a.userId === userId);
  }

  protected setStatus(value: string): void {
    const r = this.request();
    const next = value as NonNullable<RequestPatch['status']>;
    if (!r || next === r.status) return;
    if (!canMoveStatus(r.status, next)) {
      this.request.set({ ...r }); // snap the select back
      return;
    }
    this.patch({ status: next });
  }

  protected setPriority(value: string): void {
    if (value) this.patch({ priority: value as RequestPatch['priority'] });
  }

  protected setAssignee(value: string): void {
    if (!this.isAdmin()) return;
    this.patch({ assignedToId: value });
  }

  protected onReply(reply: ThreadReply): void {
    const r = this.request();
    if (!r) return;
    this.sending.set(true);
    this.replyError.set(null);
    this.api.comment(this.projectId(), r.id, reply.body, reply.attachments, reply.isInternal).subscribe({
      next: (comment) => {
        this.sending.set(false);
        const next = { ...r, comments: [...r.comments, comment], commentsCount: r.commentsCount + 1 };
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

  private patch(patch: RequestPatch): void {
    const r = this.request();
    if (!r) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.patch(this.projectId(), r.id, patch).subscribe({
      next: (fresh) => {
        this.saving.set(false);
        this.request.set(fresh);
        this.updated.emit(fresh);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.request.set({ ...r }); // re-render the selects with the saved values
        if (e?.reason === 'status_cannot_go_back') {
          // Someone moved it further meanwhile — say so once and show the real status.
          this.toast.error(errorText(e, this.lang.lang()));
          this.load();
          return;
        }
        this.error.set(errorText(e, this.lang.lang()));
        if (e?.status === 409) this.load();
      },
    });
  }
}
