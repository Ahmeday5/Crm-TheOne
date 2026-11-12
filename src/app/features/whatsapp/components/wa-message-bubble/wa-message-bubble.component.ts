import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { resolveAssetUrl } from '../../../../core/utils/asset-url.util';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ThreadMessage } from '../../state/whatsapp-thread.store';
import { MEDIA_KIND_ICON, isNoteKind, isOutgoing, mediaKindOf } from '../../utils/whatsapp.util';
import { WaStatusTicksComponent } from '../wa-status-ticks/wa-status-ticks.component';

/** A run of message text — plain, or a link (rendered as an anchor, never as HTML). */
interface TextSegment {
  text: string;
  href: string | null;
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;

export interface WaImagePreview {
  url: string;
  fileName: string | null;
}

/**
 * One chat bubble. Incoming messages sit at the start side, outgoing at the
 * end (mirrored in Arabic — as WhatsApp does).
 *
 * By `messageType`: image → thumbnail (opens the viewer) · video / audio →
 * native player · document → file chip · template → bubble tagged "Template"
 * + its name · location / reaction / system → a small muted note. Media
 * without a URL renders as a labelled placeholder. `mediaUrl` is relative
 * for files we sent (resolved against the API origin) and absolute for
 * received media.
 */
@Component({
  selector: 'app-wa-message-bubble',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, CairoDatePipe, WaStatusTicksComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-message-bubble.component.html',
  styleUrl: './wa-message-bubble.component.scss',
  host: {
    class: 'wa-msg',
    '[class.is-out]': 'outgoing() && !note()',
    '[class.is-in]': '!outgoing() && !note()',
    '[class.is-note]': 'note()',
    '[class.is-failed]': 'failed()',
    '[class.is-pending]': 'message().status === "Pending"',
  },
})
export class WaMessageBubbleComponent {
  readonly message = input.required<ThreadMessage>();
  /** Show "by {employee}" under outgoing bubbles. */
  readonly showSender = input(true);
  readonly canRetry = input(false);

  readonly retry = output<void>();
  readonly openImage = output<WaImagePreview>();

  protected readonly outgoing = computed(() => isOutgoing(this.message()));
  protected readonly failed = computed(() => this.message().status === 'Failed');
  protected readonly kind = computed(() => mediaKindOf(this.message().messageType));
  protected readonly note = computed(() => isNoteKind(this.kind()));
  protected readonly mediaSrc = computed(() => resolveAssetUrl(this.message().mediaUrl));
  protected readonly kindIcon = computed(() => {
    const kind = this.kind();
    return kind === 'text' ? '' : MEDIA_KIND_ICON[kind];
  });
  /** 0–100 while the file is uploading; `null` otherwise. */
  protected readonly progress = computed(() => {
    const m = this.message();
    return m.status === 'Pending' && typeof m.uploadProgress === 'number' ? m.uploadProgress : null;
  });
  /** Stored outgoing message without a CRM sender = sent from the Mihwar inbox / an automation. */
  protected readonly fromProvider = computed(() => {
    const m = this.message();
    return this.outgoing() && m.id > 0 && !m.sentById && !m.sentByName;
  });

  protected readonly segments = computed<TextSegment[]>(() => splitLinks(this.message().text ?? ''));

  protected viewImage(): void {
    const url = this.mediaSrc();
    if (url) this.openImage.emit({ url, fileName: this.message().fileName });
  }
}

function splitLinks(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), href: null });
    segments.push({ text: match[0], href: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), href: null });
  return segments;
}
