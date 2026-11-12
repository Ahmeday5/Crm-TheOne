import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaMessage } from '../../models/whatsapp.models';
import { messageStatusMeta } from '../../utils/whatsapp.util';

/**
 * Delivery ticks of an outgoing message:
 * Pending = clock · Sent = ✓ · Delivered = ✓✓ grey · Read = ✓✓ blue ·
 * Failed = red ! with the provider's `errorMessage` as a tooltip.
 * Renders nothing for incoming messages.
 */
@Component({
  selector: 'app-wa-status-ticks',
  standalone: true,
  imports: [TranslatePipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta(); as st) {
      @let label = st.labelKey | translate;
      @let tip = failedReason() || label;
      <i class="wa-tick wa-tick--{{ st.tone }} {{ st.icon }}" role="img"
         [appTip]="tip" [title]="tip" [attr.aria-label]="tip"></i>
    }
  `,
  styles: `
    :host { display: inline-flex; --wa-read: #34b7f1; }
    .wa-tick { font-size: 0.72rem; }
    .wa-tick--muted { color: var(--text-3); }
    .wa-tick--read { color: var(--wa-read); }
    .wa-tick--danger { color: var(--danger); cursor: help; }
  `,
})
export class WaStatusTicksComponent {
  readonly message = input.required<Pick<WaMessage, 'status' | 'errorMessage'>>();

  protected readonly meta = computed(() => messageStatusMeta(this.message().status));
  protected readonly failedReason = computed(() =>
    this.message().status === 'Failed' ? this.message().errorMessage?.trim() || null : null,
  );
}
