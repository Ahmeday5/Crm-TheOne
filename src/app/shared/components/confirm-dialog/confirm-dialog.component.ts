import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogService } from '../../../core/services/dialog.service';

/**
 * Promise-based confirm modal. Mounted once near the app root; opens whenever
 * a caller awaits `DialogService.confirm({...})`.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  private readonly dialog = inject(DialogService);
  readonly state = this.dialog.state;

  iconOf(type: string | undefined): string {
    switch (type) {
      case 'danger':  return 'fa-solid fa-triangle-exclamation';
      case 'warning': return 'fa-solid fa-circle-exclamation';
      case 'info':    return 'fa-solid fa-circle-info';
      default:        return 'fa-solid fa-circle-question';
    }
  }

  confirm(): void {
    this.dialog.handleResponse(true);
  }
  cancel(): void {
    this.dialog.handleResponse(false);
  }
}
