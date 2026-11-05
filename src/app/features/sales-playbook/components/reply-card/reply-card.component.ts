import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuickReply } from '../../models/sales-playbook.models';
import { REPLY_META, hasNamePlaceholder } from '../../utils/playbook.util';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { FavoriteButtonComponent } from '../favorite-button/favorite-button.component';

/** A canned WhatsApp reply, previewed as a chat bubble. */
@Component({
  selector: 'app-pb-reply-card',
  standalone: true,
  imports: [TranslatePipe, TipDirective, CopyButtonComponent, FavoriteButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reply-card.component.html',
  styleUrl: './reply-card.component.scss',
})
export class ReplyCardComponent {
  readonly reply = input.required<QuickReply>();
  readonly canManage = input(false);
  readonly busy = input(false);

  readonly edit = output<QuickReply>();
  readonly remove = output<QuickReply>();

  protected readonly meta = computed(() => REPLY_META[this.reply().category] ?? REPLY_META.other);
  protected readonly personalised = computed(() => hasNamePlaceholder(this.reply().text));
}
