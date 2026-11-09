import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Competitor, CompetitorMention } from '../../models/sales-playbook.models';
import { PlaybookActionsService } from '../../state/playbook-actions.service';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { matchesQuery } from '../../utils/arabic-text.util';
import { CompetitorCardComponent } from '../competitor-card/competitor-card.component';
import { CompetitorFormDialogComponent } from '../competitor-form-dialog/competitor-form-dialog.component';
import { MentionFormDialogComponent } from '../mention-form-dialog/mention-form-dialog.component';
import { PanelToolbarComponent } from '../panel-toolbar/panel-toolbar.component';

@Component({
  selector: 'app-pb-competitors-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    EmptyStateComponent,
    PanelToolbarComponent,
    CompetitorCardComponent,
    CompetitorFormDialogComponent,
    MentionFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competitors-panel.component.html',
  styleUrl: '../playbook-panel.scss',
})
export class CompetitorsPanelComponent {
  private readonly store = inject(SalesPlaybookStore);
  private readonly actions = inject(PlaybookActionsService);

  readonly isAdmin = this.store.canManage;
  readonly canMention = this.store.canMention;
  readonly busyId = this.actions.busyId;

  readonly search = signal('');
  readonly favoritesOnly = signal(false);
  readonly editing = signal<Competitor | null | undefined>(undefined);
  /** Competitor whose "link a customer" dialog is open. */
  readonly mentioning = signal<Competitor | null>(null);

  /** Search also covers the customers who mentioned a competitor. */
  readonly filtered = computed(() => {
    const q = this.search();
    return this.store
      .competitors()
      .filter((c) => !this.favoritesOnly() || this.store.isFavorite('competitors', c.id))
      .filter((c) =>
        matchesQuery(q, c.name, c.website, c.howToWin, ...c.strengths, ...c.weaknesses, ...c.mentions.map((m) => m.customerName)),
      );
  });

  readonly hasAny = computed(() => this.store.competitors().length > 0);

  /** Keeps the dialog bound to the live competitor (its mentions change while open). */
  readonly mentioningLive = computed(() => {
    const target = this.mentioning();
    return target ? (this.store.competitors().find((c) => c.id === target.id) ?? target) : null;
  });

  clearFilters(): void {
    this.search.set('');
    this.favoritesOnly.set(false);
  }

  remove(c: Competitor): void {
    void this.actions.remove('competitors', c.id, c.name);
  }

  removeMention(c: Competitor, m: CompetitorMention): void {
    void this.actions.removeMention(c, m);
  }
}
