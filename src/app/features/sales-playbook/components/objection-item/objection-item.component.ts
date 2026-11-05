import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Objection } from '../../models/sales-playbook.models';
import { OBJECTION_META } from '../../utils/playbook.util';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { FavoriteButtonComponent } from '../favorite-button/favorite-button.component';

/** Accordion row: the customer's objection → expands to the best answer. */
@Component({
  selector: 'app-pb-objection-item',
  standalone: true,
  imports: [TranslatePipe, TipDirective, CopyButtonComponent, FavoriteButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objection-item.component.html',
  styleUrl: './objection-item.component.scss',
})
export class ObjectionItemComponent {
  readonly objection = input.required<Objection>();
  readonly canManage = input(false);
  readonly busy = input(false);
  readonly expanded = model(false);

  readonly edit = output<Objection>();
  readonly remove = output<Objection>();

  protected readonly meta = computed(() => OBJECTION_META[this.objection().category] ?? OBJECTION_META.other);
}
