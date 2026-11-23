import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TipDirective } from '../../directives/tip.directive';
import { CairoDatePipe, parseUtc } from '../../pipes/cairo-date.pipe';

/**
 * "Date added" cell: `dd/MM/yyyy` with the full date + time in a tooltip.
 *
 * The API stores UTC but serializes without a trailing `Z`; `parseUtc` reads
 * it as UTC and the pipe renders it in the app's business zone, so a
 * customer added late at night never shows up on the previous day.
 *
 *   <app-created-at [value]="row.createdAt" />
 */
@Component({
  selector: 'app-created-at',
  standalone: true,
  imports: [CairoDatePipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (iso(); as datetime) {
      <time class="ca" [attr.datetime]="datetime" [appTip]="value() | cairoDate: 'datetime'">
        @if (icon()) { <i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> }
        {{ value() | cairoDate: 'numeric' }}
      </time>
    } @else {
      <span class="text-muted">—</span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .ca {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        cursor: default;
      }
      .ca i { opacity: 0.7; }
    `,
  ],
})
export class CreatedAtComponent {
  readonly value = input<string | null | undefined>(null);
  readonly icon = input(false);

  protected readonly iso = computed(() => parseUtc(this.value())?.toISOString() ?? null);
}
