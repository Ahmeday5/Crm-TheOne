import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div class="d-flex align-items-center gap-3">
        <span *ngIf="icon" class="icon-tile lg"><i [class]="icon"></i></span>
        <div>
          <h2 class="mb-1">{{ title }}</h2>
          <p *ngIf="subtitle" class="text-muted mb-0">{{ subtitle }}</p>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2"><ng-content></ng-content></div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
}
