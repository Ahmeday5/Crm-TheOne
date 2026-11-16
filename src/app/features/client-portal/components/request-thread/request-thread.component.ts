import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientRequestDetails, REQUEST_TEXT_MAX } from '../../models/client-portal.models';
import { AttachmentListComponent } from '../attachment-list/attachment-list.component';
import { AttachmentPickerComponent } from '../attachment-picker/attachment-picker.component';

export interface ThreadReply {
  body: string;
  attachments: File[];
}

/**
 * A request as a conversation: the original message first, then every reply
 * (oldest → newest). The viewer's own bubbles sit on one side, the other
 * party's on the other. A reply box at the bottom (locked once Closed).
 * Dumb: the parent sends and passes `sending` / `error` back.
 */
@Component({
  selector: 'app-request-thread',
  standalone: true,
  imports: [FormsModule, TranslatePipe, CairoDatePipe, AttachmentListComponent, AttachmentPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-thread.component.html',
  styleUrl: './request-thread.component.scss',
})
export class RequestThreadComponent {
  readonly request = input.required<ClientRequestDetails>();
  /** Who is reading: the client sees their own message on "my" side. */
  readonly viewer = input<'client' | 'staff'>('client');
  readonly sending = input(false);
  readonly error = input<string | null>(null);
  /** Bumped by the parent after a reply was saved — clears the box. */
  readonly sentCount = input(0);

  readonly reply = output<ThreadReply>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly maxLen = REQUEST_TEXT_MAX;
  protected readonly body = signal('');
  protected readonly files = signal<File[]>([]);

  protected readonly locked = computed(() => this.request().status === 'Closed');
  protected readonly canSend = computed(
    () => (!!this.body().trim() || this.files().length > 0) && !this.sending() && !this.locked(),
  );
  /** The opening message belongs to the client. */
  protected readonly originalIsMine = computed(() => this.viewer() === 'client');

  constructor() {
    // Our reply was saved → empty the box (a reply from the other side never wipes a draft).
    effect(() => {
      if (this.sentCount() > 0) {
        this.body.set('');
        this.files.set([]);
      }
    }, { allowSignalWrites: true });

    // Any new message → keep the newest in view.
    effect(() => {
      this.request().comments.length;
      queueMicrotask(() => {
        const el = this.scroller()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  protected clearFiles(): void {
    this.files.set([]);
  }

  protected send(): void {
    if (!this.canSend()) return;
    this.reply.emit({ body: this.body().trim(), attachments: this.files() });
  }
}
