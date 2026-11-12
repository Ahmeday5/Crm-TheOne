import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaMessage } from '../../models/whatsapp.models';
import { TemplateSend } from '../../state/whatsapp-thread.store';
import { isTransientError, newClientMessageId, whatsappErrorText } from '../../utils/whatsapp.util';
import { TemplateChoice, WaTemplateFormComponent } from '../wa-template-form/wa-template-form.component';

/**
 * "Send template" for an existing conversation (inbox chat past the 24-hour
 * window, or a customer profile). The host passes `send`, which knows the
 * target (`chatId` / `customerId`) and appends the stored message to the
 * thread; this dialog owns the request: spinner, inline server error with
 * the values kept, and the same `clientMessageId` on a retry after a network
 * error so the template can never go out twice.
 */
@Component({
  selector: 'app-wa-template-picker-dialog',
  standalone: true,
  imports: [TranslatePipe, ModalComponent, WaTemplateFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="true"
      size="lg"
      icon="fa-solid fa-file-signature"
      iconTone="success"
      [title]="'whatsapp.templates.title' | translate"
      [closeOnBackdrop]="!sending()"
      [closeOnEsc]="!sending()"
      (closed)="closed.emit()">

      @if (recipient(); as name) {
        <p class="text-muted small mb-3">
          <i class="fa-solid fa-user me-1" aria-hidden="true"></i>
          {{ 'whatsapp.templates.to' | translate: { name: name } }}
        </p>
      }

      <app-wa-template-form
        [instanceId]="instanceId()"
        [disabled]="sending()"
        [showErrors]="attempted()"
        (choiceChange)="onChoice($event)" />

      @if (error(); as message) {
        <p class="alert alert-danger d-flex gap-2 py-2 mt-3 mb-0" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-1" aria-hidden="true"></i><span dir="auto">{{ message }}</span>
        </p>
      }

      <ng-container modal-footer>
        <div class="btn-row w-100 justify-content-end">
          <button type="button" class="btn btn-light" (click)="closed.emit()" [disabled]="sending()">
            {{ 'whatsapp.templates.cancel' | translate }}
          </button>
          <button type="button" class="btn btn-success" (click)="submit()" [disabled]="sending()">
            @if (sending()) {
              <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            } @else {
              <i class="fa-solid fa-paper-plane me-1" aria-hidden="true"></i>
            }
            {{ 'whatsapp.templates.send' | translate }}
          </button>
        </div>
      </ng-container>
    </app-modal>
  `,
})
export class WaTemplatePickerDialogComponent {
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sends the request to this conversation (the host binds the thread store). */
  readonly send = input.required<(request: TemplateSend) => Observable<WaMessage>>();
  /** Admin: list this WhatsApp number's templates; `null` = the caller's own. */
  readonly instanceId = input<string | null>(null);
  /** Who it goes to — shown as a reminder. */
  readonly recipient = input<string | null>(null);

  readonly sent = output<WaMessage>();
  readonly closed = output<void>();

  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);
  private choice: TemplateChoice | null = null;
  /** Kept across a network failure so a retry can't send twice. */
  private clientMessageId = newClientMessageId();

  protected onChoice(choice: TemplateChoice | null): void {
    this.choice = choice;
    // A different template / different values is a different message → a new idempotency key.
    this.clientMessageId = newClientMessageId();
    this.error.set(null);
  }

  protected submit(): void {
    this.attempted.set(true);
    const choice = this.choice;
    if (!choice || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);
    this.send()({
      clientMessageId: this.clientMessageId,
      templateId: choice.template.id,
      template: choice.template.name,
      language: choice.template.language,
      parameters: choice.parameters,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          this.sending.set(false);
          this.sent.emit(message);
        },
        error: (err: unknown) => {
          this.sending.set(false);
          if (!isTransientError(err)) this.clientMessageId = newClientMessageId();
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.sendFailed'));
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
