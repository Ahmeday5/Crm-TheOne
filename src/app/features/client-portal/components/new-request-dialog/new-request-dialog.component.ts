import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/models/api-response.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ClientRequestDetails,
  REQUEST_TEXT_MAX,
  REQUEST_TITLE_MAX,
  REQUEST_TYPES,
  RequestType,
} from '../../models/client-portal.models';
import { ClientPortalService } from '../../services/client-portal.service';
import { requestTypeIcon } from '../../utils/client-portal-ui.util';
import { AttachmentPickerComponent } from '../attachment-picker/attachment-picker.component';

/** "عندي مشكلة / طلب تعديل": kind → title → details (+ screenshots). One form, one button. */
@Component({
  selector: 'app-new-request-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe, AttachmentPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-request-dialog.component.html',
  styleUrl: './new-request-dialog.component.scss',
})
export class NewRequestDialogComponent {
  private readonly api = inject(ClientPortalService);

  readonly projectId = input.required<number>();
  readonly created = output<ClientRequestDetails>();
  readonly closed = output<void>();

  protected readonly types = REQUEST_TYPES;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly titleMax = REQUEST_TITLE_MAX;
  protected readonly textMax = REQUEST_TEXT_MAX;

  protected readonly type = signal<RequestType>('Issue');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canSend = computed(
    () => !!this.title().trim() && !!this.description().trim() && !this.sending(),
  );

  protected submit(): void {
    if (!this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api
      .createRequest(this.projectId(), {
        type: this.type(),
        title: this.title(),
        description: this.description(),
        attachments: this.files(),
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.created.emit(r);
        },
        error: (e: ApiError) => {
          this.sending.set(false);
          this.error.set(e?.message ?? null);
        },
      });
  }
}
