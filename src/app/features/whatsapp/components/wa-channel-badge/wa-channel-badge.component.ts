import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChannelType } from '../../models/whatsapp.models';

/**
 * Which channel a chat / row belongs to: WhatsApp (green) or Messenger
 * (blue), optionally with the channel's name. `compact` shows the icon only
 * (the name / type stays available as a tooltip and to screen readers).
 */
@Component({
  selector: 'app-wa-channel-badge',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let typeLabel = typeKey() | translate;
    <span class="wa-cb" [attr.data-type]="type()" [class.is-compact]="compact()"
          [title]="name() ? typeLabel + ' · ' + name() : typeLabel">
      <i [class]="icon()" aria-hidden="true"></i>
      @if (compact()) {
        <span class="visually-hidden">{{ typeLabel }}</span>
      } @else {
        <span class="wa-cb__text" dir="auto">{{ name() || typeLabel }}</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; min-width: 0; max-width: 100%; }
    .wa-cb {
      --wa-cb-color: var(--success);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      min-width: 0;
      max-width: 100%;
      padding: 0.1rem 0.5rem;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--wa-cb-color) 12%, transparent);
      color: var(--wa-cb-color);
      font-size: var(--fs-xs);
      font-weight: var(--fw-600);
      line-height: 1.5;
    }
    /* Messenger's own blue / Instagram's magenta — solid brand colours, not theme tokens. */
    .wa-cb[data-type='messenger'] { --wa-cb-color: #0866ff; }
    .wa-cb[data-type='instagram'] { --wa-cb-color: #d62976; }
    .wa-cb.is-compact { padding: 0; width: 1.35rem; height: 1.35rem; justify-content: center; }
    .wa-cb__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class WaChannelBadgeComponent {
  readonly type = input.required<WaChannelType>();
  /** The channel's name (number owner / page name). */
  readonly name = input<string | null>(null);
  readonly compact = input(false);

  protected readonly icon = computed(() => {
    switch (this.type()) {
      case 'messenger': return 'fa-brands fa-facebook-messenger';
      case 'instagram': return 'fa-brands fa-instagram';
      default: return 'fa-brands fa-whatsapp';
    }
  });
  /** Anything unknown reads as WhatsApp — never a raw `…undefined` key. */
  protected readonly typeKey = computed(() => {
    switch (this.type()) {
      case 'messenger': return 'whatsapp.channelType.messenger';
      case 'instagram': return 'whatsapp.channelType.instagram';
      default: return 'whatsapp.channelType.whatsapp_cloud';
    }
  });
}
