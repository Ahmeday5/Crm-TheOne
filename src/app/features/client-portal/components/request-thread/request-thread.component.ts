import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ClientRequestComment, ClientRequestDetails, REQUEST_TEXT_MAX, isTriageStatus } from '../../models/client-portal.models';
import { requestStatusIcon, requestStatusTone } from '../../utils/client-portal-ui.util';
import { AttachmentListComponent } from '../attachment-list/attachment-list.component';
import { AttachmentPickerComponent } from '../attachment-picker/attachment-picker.component';

export interface ThreadReply {
  body: string;
  attachments: File[];
  /** Staff only — a note the client never sees. */
  isInternal: boolean;
}

/**
 * A request as a conversation: the original message, then every entry
 * (oldest → newest):
 *  - messages, the Admin's questions and the client's answers as bubbles;
 *  - internal notes (staff only — the server never sends them to the client);
 *  - status changes as small centred markers ("تم اعتماد الطلب").
 * A reply box at the bottom; staff can flip it to an internal note.
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
  /** Staff may write internal notes (default on while the request is still with the Admin). */
  readonly allowInternal = input(false);

  readonly reply = output<ThreadReply>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  protected readonly maxLen = REQUEST_TEXT_MAX;
  protected readonly body = signal('');
  protected readonly files = signal<File[]>([]);
  protected readonly internal = signal(false);

  protected readonly statusIcon = requestStatusIcon;
  protected readonly statusTone = requestStatusTone;

  protected readonly isStaff = computed(() => this.viewer() === 'staff');
  private readonly inTriage = computed(() => isTriageStatus(this.request().status));
  /** Closed for everyone; a declined request is closed for the client (staff: internal notes only). */
  protected readonly locked = computed(() => {
    const s = this.request().status;
    return s === 'Closed' || (s === 'Rejected' && !this.isStaff());
  });
  protected readonly forceInternal = computed(() => this.isStaff() && this.request().status === 'Rejected');
  protected readonly isInternal = computed(() => this.forceInternal() || (this.allowInternal() && this.internal()));
  protected readonly answering = computed(() => !this.isStaff() && this.request().status === 'NeedsClarification');
  protected readonly placeholderKey = computed(() =>
    this.isInternal()
      ? 'clientRequests.thread.internalPlaceholder'
      : this.answering()
        ? 'clientRequests.thread.answerPlaceholder'
        : 'clientPortal.thread.replyPlaceholder',
  );
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

    // While the request is still with the Admin, staff replies default to internal.
    // (A memoized boolean: replies don't reset the toggle, only a status change does.)
    effect(() => {
      const triage = this.inTriage();
      if (this.allowInternal()) untracked(() => this.internal.set(triage));
    });

    // Any new entry → keep the newest in view.
    effect(() => {
      this.request().comments.length;
      queueMicrotask(() => {
        const el = this.scroller()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  /** Brings the reply box into view and focuses it ("رد على السؤال"). */
  focusComposer(): void {
    const el = this.composer()?.nativeElement;
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  protected isBubble(c: ClientRequestComment): boolean {
    return c.kind !== 'StatusChange';
  }

  protected authorLabelKey(c: ClientRequestComment): string {
    if (c.authorRole === 'Client') return 'clientPortal.role.Client';
    return c.authorRole === 'Admin' ? 'clientPortal.role.Admin' : 'clientPortal.role.Team';
  }

  protected clearFiles(): void {
    this.files.set([]);
  }

  protected send(): void {
    if (!this.canSend()) return;
    this.reply.emit({ body: this.body().trim(), attachments: this.files(), isInternal: this.isInternal() });
  }
}
