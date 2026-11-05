import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuickReply, REPLY_CATEGORIES, ReplyCategory } from '../../models/sales-playbook.models';
import { PlaybookActionsService } from '../../state/playbook-actions.service';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { matchesQuery } from '../../utils/arabic-text.util';
import { REPLY_META } from '../../utils/playbook.util';
import { FilterChip, FilterChipsComponent } from '../filter-chips/filter-chips.component';
import { PanelToolbarComponent } from '../panel-toolbar/panel-toolbar.component';
import { ReplyCardComponent } from '../reply-card/reply-card.component';
import { ReplyFormDialogComponent } from '../reply-form-dialog/reply-form-dialog.component';

const ALL = 'all';

@Component({
  selector: 'app-pb-replies-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    EmptyStateComponent,
    PanelToolbarComponent,
    FilterChipsComponent,
    ReplyCardComponent,
    ReplyFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './replies-panel.component.html',
  styleUrl: '../playbook-panel.scss',
})
export class RepliesPanelComponent {
  private readonly store = inject(SalesPlaybookStore);
  private readonly actions = inject(PlaybookActionsService);
  private readonly language = inject(LanguageService);

  readonly isAdmin = this.store.isAdmin;
  readonly busyId = this.actions.busyId;

  readonly search = signal('');
  readonly favoritesOnly = signal(false);
  readonly category = signal<string>(ALL);
  readonly editing = signal<QuickReply | null | undefined>(undefined);

  readonly chips = computed<FilterChip[]>(() => {
    const rows = this.store.replies();
    const count = (c: ReplyCategory) => rows.filter((r) => r.category === c).length;
    return [
      { value: ALL, label: this.t('salesPlaybook.filters.all'), count: rows.length, icon: 'fa-solid fa-layer-group' },
      ...REPLY_CATEGORIES.filter((c) => count(c) > 0 || c !== 'other').map((c) => ({
        value: c,
        label: this.t(`salesPlaybook.replyCategories.${c}`),
        icon: REPLY_META[c].icon,
        count: count(c),
      })),
    ];
  });

  readonly filtered = computed(() => {
    const q = this.search();
    const category = this.category();
    return this.store
      .replies()
      .filter((r) => category === ALL || r.category === category)
      .filter((r) => !this.favoritesOnly() || this.store.isFavorite('replies', r.id))
      .filter((r) => matchesQuery(q, r.title, r.text));
  });

  readonly hasAny = computed(() => this.store.replies().length > 0);

  readonly defaultCategory = computed<ReplyCategory>(() =>
    this.category() === ALL ? 'greeting' : (this.category() as ReplyCategory),
  );

  clearFilters(): void {
    this.search.set('');
    this.favoritesOnly.set(false);
    this.category.set(ALL);
  }

  remove(r: QuickReply): void {
    void this.actions.remove('replies', r.id, r.title);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
