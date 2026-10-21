import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ClampTextDirective } from '../../directives/clamp-text.directive';

/**
 * Page title block with an optional icon, subtitle and projected actions.
 *
 * On phones the actions drop below the title and become an equal-size
 * button grid (`.btn-row`), and a long subtitle is clamped to two lines
 * (tap to read it in full).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, ClampTextDirective],
  template: `
    <div class="page-header">
      <div class="page-header-main">
        <span *ngIf="icon" class="icon-tile lg page-header-icon"><i [class]="icon"></i></span>
        <div class="min-w-0">
          <h2 class="page-header-title">{{ title }}</h2>
          <p *ngIf="subtitle" class="page-header-subtitle text-muted"
             appClampText="2" [clampTitle]="title">{{ subtitle }}</p>
        </div>
      </div>
      <div class="page-header-actions btn-row"><ng-content></ng-content></div>
    </div>
  `,
  styles: `
    @use 'breakpoints' as bp;

    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .page-header-main {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      min-width: 0;
      flex: 1 1 18rem;
    }

    .page-header-title { margin: 0 0 0.25rem; }
    .page-header-subtitle { margin: 0; }

    .page-header-actions:empty { display: none; }

    @include bp.down(md) {
      .page-header { gap: 0.85rem; margin-bottom: 1rem; }
      .page-header-icon { width: 44px; height: 44px; font-size: var(--fs-lg); }
      .page-header-subtitle { font-size: var(--fs-sm); }
      .page-header-actions { width: 100%; }
    }
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
}
