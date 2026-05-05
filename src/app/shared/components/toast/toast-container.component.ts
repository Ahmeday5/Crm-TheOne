import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Global toast stack — mount once near the app root. Reads
 * `ToastService.toasts()` directly so toasts appear instantly.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  private readonly toastSvc = inject(ToastService);
  readonly toasts = this.toastSvc.toasts;
  readonly position = this.toastSvc.position;

  iconOf(type: string): string {
    switch (type) {
      case 'success': return 'fa-solid fa-circle-check';
      case 'error':   return 'fa-solid fa-circle-xmark';
      case 'warning': return 'fa-solid fa-triangle-exclamation';
      case 'info':    return 'fa-solid fa-circle-info';
      default:        return 'fa-solid fa-circle-info';
    }
  }

  dismiss(id: string): void {
    this.toastSvc.dismiss(id);
  }

  pause(id: string): void {
    this.toastSvc.pause(id);
  }

  resume(id: string): void {
    this.toastSvc.resume(id);
  }
}
