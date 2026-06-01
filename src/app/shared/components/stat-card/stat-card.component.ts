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
