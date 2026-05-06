import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatCardTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'orange';

/**
 * KPI tile used across dashboards and list pages.
 *
 *   <app-stat-card
 *     label="إجمالي الحملات"
 *     value="24"
 *     icon="fa-solid fa-bullhorn"
 *     tone="primary"
 *     [sub]="'+3 هذا الأسبوع'" />
 *
 * Visual contract: KPI label on top, big value below, optional sub-line and
 * tinted icon tile to the inline-end. Hover lift handled by `.kpi-card` from
 * `_utilities.scss` so it stays consistent with the rest of the app.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string | null>(null);
  readonly icon = input<string | null>(null);
  readonly tone = input<StatCardTone>('primary');
  /** Override the value's color (e.g. 'text-success', 'text-danger'). */
  readonly valueClass = input<string>('');
}
