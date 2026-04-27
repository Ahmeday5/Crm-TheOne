import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
      <div class="spinner-border text-primary mb-2" role="status" [style.width.px]="size" [style.height.px]="size">
        <span class="visually-hidden">{{ 'common.loading' | translate }}</span>
      </div>
      <span>{{ 'common.loading' | translate }}</span>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  @Input() size = 36;
}
