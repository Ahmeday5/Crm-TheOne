import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface FilterChip {
  value: string;
  label: string;
  icon?: string;
  count?: number;
}

/** Single-select pill filter (categories / services). Wraps, never scrolls the page. */
@Component({
  selector: 'app-pb-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fc" role="radiogroup" [attr.aria-label]="label()">
      @for (c of chips(); track c.value; let i = $index) {
        <button type="button" class="fc-chip" role="radio" [style.--i]="i"
                [class.is-on]="value() === c.value"
                [attr.aria-checked]="value() === c.value"
                (click)="value.set(c.value)">
          @if (c.icon) { <i [class]="c.icon" aria-hidden="true"></i> }
          <span class="fc-label">{{ c.label }}</span>
          @if (c.count !== undefined) { <span class="fc-count">{{ c.count }}</span> }
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .fc { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .fc-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      max-width: 100%;
      height: 32px;
      padding: 0 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface-1);
      color: var(--text-2);
      font-size: var(--fs-sm);
      font-weight: var(--fw-600);
      animation: fc-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--i, 0) * 30ms);
      transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;

      i { font-size: 0.8rem; opacity: 0.8; }
      &:hover:not(.is-on) { border-color: var(--brand-500); color: var(--brand-500); transform: translateY(-1px); }
      &:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 2px; }
      &.is-on {
        border-color: var(--brand-500);
        background: var(--brand-500);
        color: #fff;
        box-shadow: var(--shadow-sm);
        .fc-count { background: rgba(255, 255, 255, 0.22); color: #fff; }
      }
    }
    .fc-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fc-count {
      min-width: 1.3rem;
      padding: 0 0.3rem;
      border-radius: var(--radius-pill);
      background: var(--surface-3);
      font-size: 0.7rem;
      line-height: 1.3rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    @keyframes fc-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .fc-chip { animation: none; transition: none; }
    }
  `,
})
export class FilterChipsComponent {
  readonly chips = input.required<FilterChip[]>();
  readonly value = model.required<string>();
  readonly label = input('');
}
