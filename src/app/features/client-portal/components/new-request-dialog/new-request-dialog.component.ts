import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatBytes } from '../../../project-builds/utils/build-ui.util';
import { ClientPortalGateway } from '../../data/client-portal-gateway';
import { REQUEST_TYPES, RequestType } from '../../models/client-portal.models';
import { requestTypeIcon } from '../../utils/client-portal-ui.util';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * The client describes a problem / change / question in three steps: pick the
 * kind (big, obvious buttons), give it a title, explain it (+ screenshots).
 */
@Component({
  selector: 'app-new-request-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-request-dialog.component.html',
  styleUrl: './new-request-dialog.component.scss',
})
export class NewRequestDialogComponent {
  private readonly gateway = inject(ClientPortalGateway);

  readonly projectId = input.required<number>();
  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly types = REQUEST_TYPES;
  protected readonly typeIcon = requestTypeIcon;
  protected readonly fmtBytes = formatBytes;

  protected readonly type = signal<RequestType>('Issue');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () => this.title().trim().length >= 3 && this.description().trim().length >= 5 && !this.submitting(),
  );

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []).filter((f) => f.size > 0 && f.size <= MAX_FILE_BYTES);
    this.files.update((list) => [...list, ...picked].slice(0, MAX_FILES));
    input.value = '';
  }

  protected removeFile(index: number): void {
    this.files.update((list) => list.filter((_, i) => i !== index));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.gateway
      .createRequest({
        projectId: this.projectId(),
        type: this.type(),
        title: this.title(),
        description: this.description(),
        files: this.files(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.created.emit();
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('send');
        },
      });
  }
}
