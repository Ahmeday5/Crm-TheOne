import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Placeholder rows shown while a table's first page loads — keeps the card's
 * height stable so the layout doesn't jump when data lands.
 *
 *   @if (loading()) { <app-table-skeleton [rows]="6" [columns]="5" /> }
 */
@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tsk" role="status" aria-live="polite" [attr.aria-label]="'common.loading' | translate">
      @for (r of rowList(); track r) {
        <div class="tsk__row">
          <span class="tsk__avatar"></span>
          <span class="tsk__stack">
            <span class="tsk__bar tsk__bar--name"></span>
            <span class="tsk__bar tsk__bar--sub"></span>
          </span>
          @for (c of columnList(); track c) {
            <span class="tsk__bar tsk__bar--cell" [class.tsk__bar--opt]="c > 1"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .tsk { padding: 0.5rem 1rem; }
      .tsk__row {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 0;
        border-bottom: 1px solid var(--border);
      }
      .tsk__row:last-child { border-bottom: 0; }
      .tsk__avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .tsk__stack { display: flex; flex-direction: column; gap: 0.4rem; flex: 0 0 9rem; }
      .tsk__bar { display: block; height: 0.7rem; border-radius: var(--radius-pill); }
      .tsk__bar--name { width: 80%; }
      .tsk__bar--sub { width: 55%; height: 0.55rem; }
      .tsk__bar--cell { flex: 1 1 0; min-width: 2rem; }
      .tsk__avatar,
      .tsk__bar {
        background: var(--surface-2, var(--border));
        animation: tsk-pulse 1.4s ease-in-out infinite;
      }
      @keyframes tsk-pulse { 50% { opacity: 0.45; } }
      @media (max-width: 575.98px) { .tsk__bar--opt { display: none; } }
      @media (prefers-reduced-motion: reduce) { .tsk__avatar, .tsk__bar { animation: none; } }
    `,
  ],
})
export class TableSkeletonComponent {
  readonly rows = input(6);
  readonly columns = input(4);

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly columnList = computed(() => Array.from({ length: this.columns() }, (_, i) => i));
}
