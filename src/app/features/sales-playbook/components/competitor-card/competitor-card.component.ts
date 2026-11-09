import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Competitor, CompetitorMention } from '../../models/sales-playbook.models';
import { initials } from '../../utils/playbook.util';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { FavoriteButtonComponent } from '../favorite-button/favorite-button.component';

/** Visible mention chips before "+N more". */
const MENTIONS_PREVIEW = 4;

@Component({
  selector: 'app-pb-competitor-card',
  standalone: true,
  imports: [TranslatePipe, TipDirective, CopyButtonComponent, FavoriteButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competitor-card.component.html',
  styleUrl: './competitor-card.component.scss',
})
export class CompetitorCardComponent {
  readonly competitor = input.required<Competitor>();
  /** Edit / delete the competitor (Admin). */
  readonly canManage = input(false);
  /** Link / unlink customers (Admin / Sales / Support). */
  readonly canMention = input(false);
  readonly busy = input(false);
  /** Id of the mention being removed. */
  readonly busyMentionId = input<string | null>(null);

  readonly edit = output<Competitor>();
  readonly remove = output<Competitor>();
  readonly addMention = output<Competitor>();
  readonly removeMention = output<CompetitorMention>();

  protected readonly showAllMentions = signal(false);
  protected readonly initials = initials;

  protected readonly visibleMentions = computed(() => {
    const all = this.competitor().mentions;
    return this.showAllMentions() ? all : all.slice(0, MENTIONS_PREVIEW);
  });
  protected readonly hiddenMentions = computed(() =>
    Math.max(0, this.competitor().mentions.length - this.visibleMentions().length),
  );

  /** Accepts "site.com" as well as full URLs; anything else isn't linked. */
  protected readonly websiteHref = computed(() => {
    const raw = this.competitor().website.trim();
    if (!raw || /\s/.test(raw)) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return /^[\w-]+(\.[\w-]+)+/.test(raw) ? `https://${raw}` : null;
  });
  protected readonly websiteLabel = computed(() =>
    this.competitor().website.trim().replace(/^https?:\/\//i, '').replace(/\/$/, ''),
  );

  protected mentionTip(m: CompetitorMention): string {
    return [m.customerPhone, m.note, m.createdByName ? `— ${m.createdByName}` : null].filter(Boolean).join('\n') || m.customerName;
  }
}
