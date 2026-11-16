import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ClientRequestDetails,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  RequestPatch,
} from '../../models/client-portal.models';
import { ClientRequestsStaffService, StaffOption } from '../../services/client-requests-staff.service';
import { requestTypeIcon } from '../../utils/client-portal-ui.util';
import { RequestThreadComponent, ThreadReply } from '../request-thread/request-thread.component';

/**
 * One client request, staff side: status / priority / assignee at the top,
 * the conversation below. Every change is saved immediately.
 */
@Component({
  selector: 'app-staff-request-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe, CairoDatePipe, RequestThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-request-dialog.component.html',
  styleUrl: './staff-request-dialog.component.scss',
})
export class StaffRequestDialogComponent {
  private readonly api = inject(ClientRequestsStaffService);

  readonly projectId = input.required<number>();
  readonly requestId = input.required<number>();
  readonly assignees = input<StaffOption[]>([]);

  /** The request changed (status, priority, assignee, new reply) — refresh the list row. */
  readonly updated = output<ClientRequestDetails>();
  readonly closed = output<void>();

  protected readonly statuses = REQUEST_STATUSES;
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
    return this.assignees().some((a) => a.userId === userId);
  }

  protected setStatus(value: string): void {
    this.patch({ status: value as RequestPatch['status'] });
  }

  protected setPriority(value: string): void {
    if (value) this.patch({ priority: value as RequestPatch['priority'] });
  }

  protected setAssignee(value: string): void {
    this.patch({ assignedToId: value });
  }

  protected onReply(reply: ThreadReply): void {
    const r = this.request();
    if (!r) return;
    this.sending.set(true);
    this.replyError.set(null);
    this.api.comment(this.projectId(), r.id, reply.body, reply.attachments).subscribe({
      next: (comment) => {
        this.sending.set(false);
        const next = { ...r, comments: [...r.comments, comment], commentsCount: r.commentsCount + 1 };
        this.request.set(next);
        this.sentCount.update((n) => n + 1);
        this.updated.emit(next);
      },
      error: (e: ApiError) => {
        this.sending.set(false);
        this.replyError.set(e?.message ?? null);
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
        this.error.set(e?.message ?? null);
        this.request.set({ ...r }); // re-render the selects with the saved values
      },
    });
  }
}
