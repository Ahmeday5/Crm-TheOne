import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Competitor } from '../../models/sales-playbook.models';
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
  readonly canManage = input(false);
  readonly busy = input(false);

  readonly edit = output<Competitor>();
  readonly remove = output<Competitor>();

  protected readonly showAllMentions = signal(false);
  protected readonly initials = initials;

  protected readonly visibleMentions = computed(() => {
    const all = this.competitor().mentions;
    return this.showAllMentions() ? all : all.slice(0, MENTIONS_PREVIEW);
  });
  protected readonly hiddenMentions = computed(() =>
    Math.max(0, this.competitor().mentions.length - this.visibleMentions().length),
  );

  /** Accepts "site.com" as well as full URLs. */
  protected readonly websiteHref = computed(() => {
    const raw = this.competitor().website.trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  });
  protected readonly websiteLabel = computed(() =>
    this.competitor().website.trim().replace(/^https?:\/\//i, '').replace(/\/$/, ''),
  );
}
