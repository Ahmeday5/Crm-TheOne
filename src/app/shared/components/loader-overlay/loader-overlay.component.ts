import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';

/**
 * Global page-level loader. Mounted once at the app root; it shows whenever
 * `LoaderService.isLoading()` is true (interceptor counter > 0).
 *
 * Component-local spinners (action buttons, table skeletons) opt out of this
 * overlay via `withSkipLoader()`.
 */
@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="app-loader" role="status" aria-live="polite" aria-busy="true">
        <div class="spinner-ring"></div>
      </div>
    }
  `,
  styleUrl: './loader-overlay.component.scss',
})
export class LoaderOverlayComponent {
  readonly isLoading = inject(LoaderService).isLoading;
}
