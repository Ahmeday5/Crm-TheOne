import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChannelType, WaInstanceStatus } from '../../models/whatsapp.models';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { InstanceStatusMeta, channelLabel, instanceStatusMeta, isChannelActive } from '../../utils/whatsapp.util';

/** One line of the card: a channel the employee owns. */
interface OwnChannelRow {
  id: string;
  type: WaChannelType;
  label: string;
  canSend: boolean;
  meta: InstanceStatusMeta;
}

/**
 * The employee's own channels at the top of the inbox (employees have no
 * channel list): at most one WhatsApp number and one Messenger page, each
 * with its live status. Channels are linked by the admin in the Mihwar
 * dashboard — a disconnected one says so instead of offering a button.
 */
@Component({
  selector: 'app-wa-number-card',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.status() && !session.channelsLoaded()) {
      @if (session.statusError(); as error) {
        <div class="wa-nc wa-nc--muted">
          <span class="wa-nc__text">{{ error }}</span>
          <button type="button" class="btn btn-sm btn-light" (click)="session.loadStatus()">
            <i class="fa-solid fa-rotate me-1"></i>{{ 'whatsapp.retry' | translate }}
          </button>
        </div>
      } @else {
        <div class="wa-nc wa-nc--muted" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span class="wa-nc__text">{{ 'whatsapp.number.checking' | translate }}</span>
        </div>
      }
    } @else if (rows().length === 0) {
      <div class="wa-nc wa-nc--muted" role="status">
        <span class="wa-nc__icon tone-gray"><i class="fa-solid fa-sim-card"></i></span>
        <span class="wa-nc__text">{{ 'whatsapp.number.unassigned' | translate }}</span>
      </div>
    } @else {
      <ul class="wa-nc__list" role="list">
        @for (row of rows(); track row.id) {
          <li class="wa-nc" [class.wa-nc--ok]="row.canSend" [class.wa-nc--bad]="!row.canSend">
            <span class="wa-nc__icon" [attr.data-type]="row.type">
              <i [class]="row.type === 'messenger' ? 'fa-brands fa-facebook-messenger' : 'fa-brands fa-whatsapp'"></i>
            </span>
            <span class="wa-nc__body">
              <span class="wa-nc__phone" dir="auto">{{ row.label }}</span>
              <span class="wa-nc__meta">
                <span class="wa-dot wa-dot--{{ row.meta.tone }}" aria-hidden="true"></span>
                {{ row.meta.labelKey | translate }}
                @if (!row.canSend) {
                  <span>· {{ 'whatsapp.number.askAdmin' | translate }}</span>
                }
              </span>
            </span>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './wa-number-card.component.scss',
})
export class WaNumberCardComponent {
  protected readonly session = inject(WhatsAppSessionStore);

  /** `/instances` (own channels); falls back to `/status` before the list is known. */
  protected readonly rows = computed<OwnChannelRow[]>(() => {
    const channels = this.session.channels().filter(isChannelActive);
    if (channels.length) {
      return [...channels]
        .sort((a, b) => Number(b.type === 'whatsapp_cloud') - Number(a.type === 'whatsapp_cloud'))
        .map((c) => ({
          id: c.id,
          type: c.type,
          label: channelLabel(c),
          canSend: c.canSend,
          meta: instanceStatusMeta(c.canSend ? 'CONNECTED' : c.status),
        }));
    }
    const status = this.session.status();
    if (!status || status.status === 'NOT_ASSIGNED' || !status.instanceId) return [];
    return [
      {
        id: status.instanceId,
        type: 'whatsapp_cloud',
        label: channelLabel({ id: status.instanceId, name: status.name, phoneNumber: status.phoneNumber }),
        canSend: status.canSend,
        meta: instanceStatusMeta(status.canSend ? 'CONNECTED' : (status.status as WaInstanceStatus)),
      },
    ];
  });
}
