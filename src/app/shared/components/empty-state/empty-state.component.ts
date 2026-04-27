import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="text-center py-5">
      <span class="icon-tile lg mx-auto mb-3"><i [class]="icon"></i></span>
      <h5 class="mb-2">{{ title }}</h5>
      <p *ngIf="message" class="text-muted mb-3">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message?: string;
  @Input() icon = 'fa-solid fa-inbox';
}
