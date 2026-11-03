import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaInstance } from '../../models/whatsapp.models';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  canPair,
  formatWhatsAppPhone,
  instanceStatusMeta,
  isChannelActive,
} from '../../utils/whatsapp.util';

/**
 * Admin: every company number as a "channel" (like a multi-line WhatsApp
 * inbox). "All channels" on top; each line shows its status dot, assignee,
 * chat count and unread badge. Removed numbers are greyed and read-only;
 * numbers that aren't connected offer "Get pairing code".
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
  readonly pair = output<WaInstance>();

  /** Working numbers first, then by phone; removed ones last. */
  protected readonly channels = computed(() =>
    [...this.session.channels()].sort(
      (a, b) =>
        Number(isChannelActive(b)) - Number(isChannelActive(a)) ||
        Number(b.canSend) - Number(a.canSend) ||
        (a.phoneNumber ?? '').localeCompare(b.phoneNumber ?? ''),
    ),
  );

  protected phone(c: WaInstance): string {
    return formatWhatsAppPhone(c.phoneNumber);
  }

  protected meta(c: WaInstance) {
    return instanceStatusMeta(c.status);
  }

  protected active(c: WaInstance): boolean {
    return isChannelActive(c);
  }

  protected pairable(c: WaInstance): boolean {
    return canPair(c);
  }
}
