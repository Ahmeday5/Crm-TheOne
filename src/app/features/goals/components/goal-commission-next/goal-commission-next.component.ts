import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CommissionMilestone, CommissionScope } from '../../utils/goal-commission.util';

/**
 * "Next tier" nudge: how much is left to collect, the rate that unlocks and
 * what the commission becomes (with the gain over today).
 *
 *   <app-goal-commission-next [milestone]="insight.next" [scope]="insight.scope" />
 *   <app-goal-commission-next ... tone="inverse" />   (on the gradient banner)
 */
@Component({
  selector: 'app-goal-commission-next',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe, PercentLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-inverse]': 'tone() === "inverse"', '[attr.data-tier]': 'milestone().tier' },
  template: `
    <span class="gcn-icon" aria-hidden="true"><i class="fa-solid fa-arrow-trend-up"></i></span>
    <div class="gcn-body">
      <span class="gcn-title">{{ 'goals.commission.next.title' | translate }}</span>
      <p class="gcn-line">
        @if (milestone().remaining > 0) {
          {{ 'goals.commission.next.remaining' | translate }}
          <strong>{{ milestone().remaining | money }}</strong>
          {{ (milestone().tier === 'UpToTarget' ? 'goals.commission.next.toThreshold' : 'goals.commission.next.toAbove') | translate }}
        } @else {
          {{ 'goals.commission.next.anyExtra' | translate }}
        }
      </p>
      <p class="gcn-line">
        {{ 'goals.commission.next.rateBecomes' | translate }}
        <strong class="gcn-accent">{{ milestone().rate | pct:2 }}</strong>
        {{ 'goals.commission.next.commissionBecomes' | translate }}
        @if (milestone().tier === 'AboveTarget') { {{ 'goals.commission.next.moreThan' | translate }} }
        <strong class="gcn-accent">{{ milestone().projectedAmount | money }}</strong>
        @if (milestone().gain > 0) {
          <span class="gcn-gain">+{{ milestone().gain | money }}</span>
        }
      </p>
      @if (scope() === 'personal') {
        <small class="gcn-note">{{ 'goals.commission.next.onCurrentShare' | translate }}</small>
      }
    </div>
  `,
  styles: [
    `
      :host {
        --gcn-accent: var(--success);
        --gcn-text: var(--text-1);
        --gcn-muted: var(--text-2);
        --gcn-bg: color-mix(in srgb, var(--gcn-accent) 8%, transparent);
        --gcn-border: color-mix(in srgb, var(--gcn-accent) 40%, transparent);

        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.55rem 0.7rem;
        border: 1px dashed var(--gcn-border);
        border-radius: 8px;
        background: var(--gcn-bg);
        color: var(--gcn-muted);
        font-size: var(--fs-xs);
        line-height: 1.55;
      }
      :host([data-tier='AboveTarget']) { --gcn-accent: #2563eb; }
      :host(.is-inverse) {
        --gcn-accent: #86efac;
        --gcn-text: #fff;
        --gcn-muted: rgba(255, 255, 255, 0.86);
        --gcn-bg: rgba(255, 255, 255, 0.1);
        --gcn-border: rgba(255, 255, 255, 0.35);
      }
      :host(.is-inverse[data-tier='AboveTarget']) { --gcn-accent: #93c5fd; }

      .gcn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.6rem;
        height: 1.6rem;
        flex-shrink: 0;
        border-radius: 50%;
        background: color-mix(in srgb, var(--gcn-accent) 18%, transparent);
        color: var(--gcn-accent);
        font-size: 0.75rem;
      }
      .gcn-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
      .gcn-title { color: var(--gcn-text); font-weight: var(--fw-700); }
      .gcn-line { margin: 0; overflow-wrap: anywhere; }
      .gcn-line strong { color: var(--gcn-text); font-weight: var(--fw-700); }
      .gcn-line .gcn-accent { color: var(--gcn-accent); }
      .gcn-gain {
        display: inline-block;
        margin-inline-start: 0.25rem;
        padding: 0 0.45rem;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--gcn-accent) 18%, transparent);
        color: var(--gcn-accent);
        font-weight: var(--fw-700);
        white-space: nowrap;
      }
      .gcn-note { opacity: 0.8; }
    `,
  ],
})
export class GoalCommissionNextComponent {
  readonly milestone = input.required<CommissionMilestone>();
  readonly scope = input<CommissionScope>('goal');
  readonly tone = input<'surface' | 'inverse'>('surface');
}
