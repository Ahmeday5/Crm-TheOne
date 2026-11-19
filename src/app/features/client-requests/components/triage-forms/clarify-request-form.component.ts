import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AttachmentPickerComponent } from '../../../client-portal/components/attachment-picker/attachment-picker.component';
import { REQUEST_TEXT_MAX } from '../../../client-portal/models/client-portal.models';

export interface ClarifyInput {
  question: string;
  attachments: File[];
}

/** Ask the client what's unclear — the request waits for them, then comes back by itself. */
@Component({
  selector: 'app-clarify-request-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe, AttachmentPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="tf" (ngSubmit)="submit()">
      <label class="tf-field">
        <span class="tf-label">{{ 'clientRequests.review.askTitle' | translate }}</span>
        <textarea #box class="form-control" name="question" rows="3" [maxlength]="textMax" [disabled]="busy()"
                  [placeholder]="'clientRequests.review.askPlaceholder' | translate"
                  [ngModel]="question()" (ngModelChange)="question.set($event)" (keydown.control.enter)="submit()"></textarea>
      </label>
      <p class="tf-hint"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>{{ 'clientRequests.review.askHint' | translate }}</p>
      <app-attachment-picker [compact]="true" [disabled]="busy()" [(files)]="files" />
      <div class="tf-actions">
        <button type="button" class="btn btn-light btn-sm" [disabled]="busy()" (click)="cancel.emit()">{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn btn-warning btn-sm" [disabled]="!canSend()">
          @if (busy()) { <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> }
          @else { <i class="fa-solid fa-paper-plane me-1" aria-hidden="true"></i> }
          {{ 'clientRequests.review.sendQuestion' | translate }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './triage-forms.scss',
})
export class ClarifyRequestFormComponent {
  readonly busy = input(false);
  readonly asked = output<ClarifyInput>();
  readonly cancel = output<void>();

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  protected readonly textMax = REQUEST_TEXT_MAX;
  protected readonly question = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly canSend = computed(() => !!this.question().trim() && !this.busy());

  ngAfterViewInit(): void {
    queueMicrotask(() => this.box()?.nativeElement.focus());
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.asked.emit({ question: this.question().trim(), attachments: this.files() });
  }
}
