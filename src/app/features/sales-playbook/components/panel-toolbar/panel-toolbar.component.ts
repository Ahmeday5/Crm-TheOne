import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/**
 * Search + "favourites only" + admin "add" — the same toolbar on every tab.
 * Filter chips (if any) are projected underneath.
 */
@Component({
  selector: 'app-pb-panel-toolbar',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-toolbar.component.html',
  styleUrl: './panel-toolbar.component.scss',
})
export class PanelToolbarComponent {
  readonly search = model('');
  readonly favoritesOnly = model(false);
  readonly placeholder = input('');
  readonly canAdd = input(false);
  readonly addLabel = input('');

  readonly add = output<void>();

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
