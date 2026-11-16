import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatBytes } from '../../../project-builds/utils/build-ui.util';
import { ClientPortalGateway } from '../../data/client-portal-gateway';
import {
  ClientRequest,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  RequestPriority,
  RequestStatus,
} from '../../models/client-portal.models';
import { requestPriorityClass, requestStatusClass, requestTypeIcon } from '../../utils/client-portal-ui.util';

/**
 * One request: what was asked, the conversation, and a reply box. Staff
 * (`staff = true`) also triage it — status + priority — from the header.
 */
@Component({
  selector: 'app-request-thread-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-thread-dialog.component.html',
  styleUrl: './request-thread-dialog.component.scss',
})
export class RequestThreadDialogComponent {
  private readonly gateway = inject(ClientPortalGateway);

  readonly request = input.required<ClientRequest>();
  readonly staff = input(false);
  readonly closed = output<void>();

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly priorities = REQUEST_PRIORITIES;
  protected readonly statusClass = requestStatusClass;
  protected readonly priorityClass = requestPriorityClass;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly fmtBytes = formatBytes;

  protected readonly comments = toSignal(
    toObservable(computed(() => this.request().id)).pipe(switchMap((id) => this.gateway.comments$(id))),
    { initialValue: [] },
  );

  protected readonly reply = signal('');
  protected readonly sending = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);

  /** Closed requests can't take new replies (a new request is the way). */
  protected readonly locked = computed(() => this.request().status === 'Closed');

  protected send(): void {
    const body = this.reply().trim();
    if (!body || this.sending() || this.locked()) return;
    this.sending.set(true);
    this.error.set(false);
    this.gateway.addComment(this.request().id, body, []).subscribe({
      next: () => {
        this.sending.set(false);
        this.reply.set('');
      },
      error: () => {
        this.sending.set(false);
        this.error.set(true);
      },
    });
  }

  protected setStatus(status: RequestStatus): void {
    this.patch({ status });
  }

  protected setPriority(value: string): void {
    this.patch({ priority: (value || null) as RequestPriority | null });
  }

  private patch(patch: { status?: RequestStatus; priority?: RequestPriority | null }): void {
    this.saving.set(true);
    this.gateway.updateRequest(this.request().id, patch).subscribe({
      next: () => this.saving.set(false),
      error: () => {
        this.saving.set(false);
        this.error.set(true);
      },
    });
  }
}
