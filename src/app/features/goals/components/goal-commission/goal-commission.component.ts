import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Goal } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Commission status line for a goal: "Commission is earned at 70%" plus an
 * eligible / not-eligible badge. Renders nothing when the goal has no
 * threshold (`commissionThresholdPercent === null`) — callers that add
 * spacing around it should guard on the threshold themselves.
 *
 *   <app-goal-commission [goal]="goal" />
 *   <app-goal-commission [goal]="goal" layout="stacked" />
 */
@Component({
  selector: 'app-goal-commission',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-stacked]': 'layout() === "stacked"' },
  template: `
    @if (threshold() !== null) {
      <span class="gcm-threshold">
        <i class="fa-solid fa-percent"></i>
        {{ 'goals.commission.thresholdPrefix' | translate }}
        <strong>{{ threshold() }}%</strong>
      </span>
      <span class="gcm-badge" [class.gcm-badge--ok]="eligible()" [class.gcm-badge--no]="!eligible()">
        <i [class]="eligible() ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'"></i>
        {{ (eligible() ? 'goals.commission.eligible' : 'goals.commission.notEligible') | translate }}
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.4rem 0.75rem;
      }
      :host(.is-stacked) { flex-direction: column; align-items: flex-start; }

      .gcm-threshold {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--text-2);
        font-size: var(--fs-sm);

        > i { color: var(--brand); font-size: 0.8em; }
        strong { color: var(--text-1); }
      }

      .gcm-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.6rem;
        border-radius: var(--radius-pill);
        font-size: var(--fs-xs);
        font-weight: var(--fw-600);
        white-space: nowrap;

        &--ok { background: var(--success-soft); color: var(--success); }
        &--no { background: var(--danger-soft); color: var(--danger); }
      }
    `,
  ],
})
export class GoalCommissionComponent {
  readonly goal = input.required<Goal>();
  readonly layout = input<'inline' | 'stacked'>('inline');

  protected readonly threshold = computed(() => this.goal().commissionThresholdPercent ?? null);
  protected readonly eligible = computed(() => !!this.goal().isCommissionEligible);
}
