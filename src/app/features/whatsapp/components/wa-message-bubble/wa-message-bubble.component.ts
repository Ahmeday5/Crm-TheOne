import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { resolveAssetUrl } from '../../../../core/utils/asset-url.util';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ThreadMessage } from '../../state/whatsapp-thread.store';
import {
  MEDIA_KIND_ICON,
  isOutgoing,
  mediaKindOf,
  messageStatusMeta,
} from '../../utils/whatsapp.util';

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
 * One chat bubble. Outgoing messages sit on the right, incoming on the left
 * (physical sides, as on WhatsApp, whatever the UI language).
 *
 * Media: outgoing rows carry a `mediaUrl` and render inline (image → opens
 * the viewer, video/audio → native player, document → file card). Incoming
 * media isn't stored server-side, so it renders as a labelled placeholder.
 */
@Component({
  selector: 'app-wa-message-bubble',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-message-bubble.component.html',
  styleUrl: './wa-message-bubble.component.scss',
  host: {
    class: 'wa-msg',
    '[class.is-out]': 'outgoing()',
    '[class.is-in]': '!outgoing()',
    '[class.is-failed]': 'failed()',
    '[class.is-pending]': 'message().status === "Pending"',
  },
})
export class WaMessageBubbleComponent {
  readonly message = input.required<ThreadMessage>();
  /** Show "by {employee}" under outgoing bubbles. */
  readonly showSender = input(true);
  readonly canRetry = input(false);
  /** Disables the retry button while another send is in flight. */
  readonly busy = input(false);

  readonly retry = output<void>();
  readonly openImage = output<WaImagePreview>();

  protected readonly outgoing = computed(() => isOutgoing(this.message()));
  protected readonly failed = computed(() => this.message().status === 'Failed');
  protected readonly kind = computed(() => mediaKindOf(this.message().messageType));
  protected readonly mediaSrc = computed(() => resolveAssetUrl(this.message().mediaUrl));
  protected readonly status = computed(() => (this.outgoing() ? messageStatusMeta(this.message().status) : null));
  protected readonly kindIcon = computed(() => {
    const kind = this.kind();
    return kind === 'text' ? '' : MEDIA_KIND_ICON[kind];
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
