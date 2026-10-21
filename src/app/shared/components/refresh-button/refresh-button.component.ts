import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { PageCacheService } from '../../../core/services/page-cache.service';
import { CairoDatePipe } from '../../pipes/cairo-date.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * "Refresh data" for a page: drops every cached response the page (and the
 * widgets on it) used, then asks the page to reload — so the reload is
 * guaranteed to hit the server.
 *
 *   <app-refresh-button [loading]="loading()" (refresh)="reload()" />
 *
 * Child widgets that load their own data refresh themselves through
 * `onCacheInvalidated()`. Shows the time of the last manual refresh.
 */
@Component({
  selector: 'app-refresh-button',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-light refresh-btn"
            [disabled]="loading()"
            [title]="lastRefreshed()
              ? ('common.refreshData.last' | translate) + ' ' + (lastRefreshed() | cairoDate:'time')
              : ('common.refreshData.hint' | translate)"
            (click)="onClick()">
      <i class="fa-solid fa-rotate-right" [class.fa-spin]="loading()" aria-hidden="true"></i>
      <span>{{ 'common.refreshData.label' | translate }}</span>
    </button>
  `,
  styles: [`
    :host { display: contents; }
    .refresh-btn { white-space: nowrap; }
  `],
})
export class RefreshButtonComponent {
  /** The page's own loading flag — disables the button and spins the icon. */
  readonly loading = input<boolean>(false);
  readonly refresh = output<void>();

  private readonly pageCache = inject(PageCacheService);
  protected readonly lastRefreshed = signal<Date | null>(null);

  protected onClick(): void {
    if (this.loading()) return;
    this.pageCache.refreshCurrentPage();
    this.lastRefreshed.set(new Date());
    this.refresh.emit();
  }
}
