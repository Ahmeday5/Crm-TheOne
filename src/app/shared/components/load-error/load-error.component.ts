import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-load-error',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
      <i class="fa-solid fa-circle-exclamation"></i>
      <span class="flex-grow-1">{{ message || ('common.loadFailed' | translate) }}</span>
      <button type="button" class="btn btn-sm btn-light" (click)="retry.emit()" [disabled]="loading">
        <i class="fa-solid fa-rotate me-1" [class.fa-spin]="loading"></i>{{ 'common.retry' | translate }}
      </button>
    </div>
  `,
})
export class LoadErrorComponent {
  @Input() message: string | null = null;
  @Input() loading = false;
  @Output() retry = new EventEmitter<void>();
}
