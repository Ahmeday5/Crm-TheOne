import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaInstance } from '../../models/whatsapp.models';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { InstanceStatusMeta, channelLabel, channelTypeIcon, instanceStatusMeta, isChannelActive } from '../../utils/whatsapp.util';

/**
 * Admin: every channel (WhatsApp numbers and Messenger pages), like a
 * multi-line inbox. "All channels" on top; each line shows its type, name,
 * status, assignee, chat count and unread badge. Removed channels are greyed
 * and read-only; channels are (re)linked in the Mihwar dashboard, not here.
 */
@Component({
  selector: 'app-wa-channel-list',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-channel-list.component.html',
  styleUrl: './wa-channel-list.component.scss',
})
export class WaChannelListComponent {
  protected readonly session = inject(WhatsAppSessionStore);

  /** Selected channel id — `null` = all channels. */
  readonly selectedId = input<string | null>(null);

  readonly selected = output<string | null>();

  protected readonly channelIcon = channelTypeIcon;

  /**
   * Channels removed from the provider ("محذوفة من محور") are hidden entirely —
   * a deleted channel never shows. Of the rest: WhatsApp before Messenger before
   * Instagram, connected first, then by name.
   */
  protected readonly channels = computed(() =>
    this.session
      .channels()
      .filter((c) => isChannelActive(c))
      .sort(
        (a, b) =>
          Number(b.type === 'whatsapp_cloud') - Number(a.type === 'whatsapp_cloud') ||
          Number(b.canSend) - Number(a.canSend) ||
          channelLabel(a).localeCompare(channelLabel(b)),
      ),
  );

  protected label(c: WaInstance): string {
    return channelLabel(c);
  }

  protected meta(c: WaInstance): InstanceStatusMeta {
    return instanceStatusMeta(c.status);
  }

  protected active(c: WaInstance): boolean {
    return isChannelActive(c);
  }
}
