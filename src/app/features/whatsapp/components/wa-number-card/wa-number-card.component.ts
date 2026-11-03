import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { formatWhatsAppPhone, instanceStatusMeta } from '../../utils/whatsapp.util';

/**
 * The employee's own number, at the top of the inbox (employees have no
 * channel list). Three states, driven by `GET /status`:
 *
 *   NOT_ASSIGNED → "ask your admin" (no connect button);
 *   canSend      → phone · Connected · last seen;
 *   otherwise    → status + "Connect your WhatsApp" (emits `connect`).
 */
@Component({
  selector: 'app-wa-number-card',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = session.status();
    @if (!s) {
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
    } @else if (s.status === 'NOT_ASSIGNED') {
      <div class="wa-nc wa-nc--muted" role="status">
        <span class="wa-nc__icon tone-gray"><i class="fa-solid fa-sim-card"></i></span>
        <span class="wa-nc__text">{{ 'whatsapp.number.unassigned' | translate }}</span>
      </div>
    } @else {
      <div class="wa-nc" [class.wa-nc--ok]="s.canSend" [class.wa-nc--bad]="!s.canSend">
        <span class="wa-nc__icon"><i class="fa-brands fa-whatsapp"></i></span>
        <span class="wa-nc__body">
          <span class="wa-nc__phone" dir="ltr">{{ phone() || ('whatsapp.numbers.noPhone' | translate) }}</span>
          <span class="wa-nc__meta">
            <span class="wa-dot wa-dot--{{ meta().tone }}" aria-hidden="true"></span>
            {{ (s.canSend ? 'whatsapp.number.connected' : meta().labelKey) | translate }}
            @if (s.isDefault) {
              <span>· {{ 'whatsapp.number.companyNumber' | translate }}</span>
            }
            @if (s.lastSeenAt) {
              <span class="wa-nc__seen">· {{ 'whatsapp.number.lastSeen' | translate }} {{ s.lastSeenAt | cairoDate: 'datetime' }}</span>
            }
          </span>
        </span>
        @if (!s.canSend && s.status !== 'BANNED') {
          <button type="button" class="btn btn-sm btn-success" (click)="connect.emit()">
            <i class="fa-solid fa-link me-1"></i>{{ 'whatsapp.connect.cta' | translate }}
          </button>
        }
      </div>
    }
  `,
  styleUrl: './wa-number-card.component.scss',
})
export class WaNumberCardComponent {
  protected readonly session = inject(WhatsAppSessionStore);

  readonly connect = output<void>();

  protected readonly phone = computed(() => formatWhatsAppPhone(this.session.status()?.phoneNumber));
  protected readonly meta = computed(() => instanceStatusMeta(this.session.status()?.status));
}
