import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Visual tone for the icon tile — mirrors the `.icon-tile.tone-*` palette. */
export type EmptyStateTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="empty-state d-flex flex-column align-items-center justify-content-center text-center"
      [class.compact]="compact"
    >
      <span class="icon-tile xl tone-{{ tone }} mb-3">
        <i [class]="icon"></i>
      </span>
      <h6 class="fw-700 mb-1">
        {{ title || ('common.emptyState.title' | translate) }}
      </h6>
      <p class="text-muted mb-0">
        {{ message || ('common.emptyState.hint' | translate) }}
      </p>

      @if (retry.observed || hasActions) {
        <div
          class="d-flex flex-wrap align-items-center justify-content-center gap-2 mt-3"
        >
          @if (retry.observed) {
            <button
              type="button"
              class="btn btn-sm btn-light"
              (click)="retry.emit()"
              [disabled]="loading"
            >
              <i class="fa-solid fa-rotate me-1" [class.fa-spin]="loading"></i>
              {{ 'common.refresh' | translate }}
            </button>
          }
          <ng-content></ng-content>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        padding: 3rem 1.5rem;
      }
      .empty-state.compact {
        padding: 1.75rem 1rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Font Awesome icon classes shown inside the tile. */
  @Input() icon = 'fa-solid fa-inbox';
  /** Icon-tile tone (`.icon-tile.tone-*`). */
  @Input() tone: EmptyStateTone = 'primary';
  /** Heading. Falls back to a translated default. */
  @Input() title: string | null = null;
  /** Sub-text. Falls back to a translated default. */
  @Input() message: string | null = null;
  /** Spins the refresh icon and disables the button while re-fetching. */
  @Input() loading = false;
  /** Tighter padding for in-card / in-table use. */
  @Input() compact = false;
  /** Set when projecting custom action buttons so the action row renders. */
  @Input() hasActions = false;

  /** Emitted when the user clicks Refresh. The button shows only when bound. */
  @Output() retry = new EventEmitter<void>();
}
