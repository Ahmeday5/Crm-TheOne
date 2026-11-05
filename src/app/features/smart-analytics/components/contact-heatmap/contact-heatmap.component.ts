import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { HourLabelPipe } from '../../pipes/hour-label.pipe';
import { HEAT_THRESHOLDS, HeatCell, MIN_SLOT_CALLS, WORK_HOURS } from '../../utils/contact-time.util';

/**
 * Day × hour answer-rate heatmap (custom CSS grid).
 *
 * Cells sweep in diagonally, hovering draws a crosshair over the row and
 * column, and clicking / focusing a cell pins its details in the readout
 * below — so the exact numbers are reachable on touch screens too.
 */
@Component({
  selector: 'app-contact-heatmap',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, TipDirective, HourLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-heatmap.component.html',
  styleUrl: './contact-heatmap.component.scss',
})
export class ContactHeatmapComponent {
  readonly rows = input.required<HeatCell[][]>();
  readonly hours = input<ReadonlyArray<number>>(WORK_HOURS);

  readonly thresholds = HEAT_THRESHOLDS;
  readonly minCalls = MIN_SLOT_CALLS;
  readonly levels = [0, 1, 2, 3, 4] as const;

  /** Crosshair (pointer / keyboard focus). */
  readonly hovered = signal<HeatCell | null>(null);
  /** Pinned cell shown in the readout; defaults to the #1 recommendation. */
  readonly pinned = signal<HeatCell | null>(null);

  readonly readout = computed<HeatCell | null>(
    () =>
      this.hovered() ??
      this.pinned() ??
      this.rows()
        .flat()
        .find((c) => c.rank === 1) ??
      null,
  );

  /** Changes with every data set so the reveal animation replays. */
  readonly dataKey = computed(() =>
    this.rows()
      .flat()
      .reduce((s, c) => s + c.calls, 0),
  );

  isSame(a: HeatCell | null, b: HeatCell): boolean {
    return !!a && a.day === b.day && a.hour === b.hour;
  }

  pin(cell: HeatCell): void {
    this.pinned.set(this.isSame(this.pinned(), cell) ? null : cell);
  }
}
