import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Objection } from '../../models/sales-playbook.models';
import { PlaybookActionsService } from '../../state/playbook-actions.service';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { matchesQuery } from '../../utils/arabic-text.util';
import { categoryMeta } from '../../utils/playbook.util';
import { FilterChip, FilterChipsComponent } from '../filter-chips/filter-chips.component';
import { ObjectionFormDialogComponent } from '../objection-form-dialog/objection-form-dialog.component';
import { ObjectionItemComponent } from '../objection-item/objection-item.component';
import { PanelToolbarComponent } from '../panel-toolbar/panel-toolbar.component';

const ALL = '\u0000all';

@Component({
  selector: 'app-pb-objections-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    EmptyStateComponent,
    PanelToolbarComponent,
    FilterChipsComponent,
    ObjectionItemComponent,
    ObjectionFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objections-panel.component.html',
  styleUrl: '../playbook-panel.scss',
})
export class ObjectionsPanelComponent {
  private readonly store = inject(SalesPlaybookStore);
  private readonly actions = inject(PlaybookActionsService);
  private readonly language = inject(LanguageService);

  readonly isAdmin = this.store.canManage;
  readonly busyId = this.actions.busyId;

  readonly search = signal('');
  readonly favoritesOnly = signal(false);
  readonly category = signal<string>(ALL);
  /** Only one answer open at a time keeps the list scannable. */
  readonly openId = signal<string | null>(null);
  readonly editing = signal<Objection | null | undefined>(undefined);

  /** One chip per category in the data ("All" = the sum). */
  readonly chips = computed<FilterChip[]>(() => {
    const categories = this.store.objectionCategories();
    if (!categories.length) return [];
    return [
      {
        value: ALL,
        label: this.t('salesPlaybook.filters.all'),
        count: categories.reduce((sum, c) => sum + c.count, 0),
        icon: 'fa-solid fa-layer-group',
      },
      ...categories.map((c) => ({ value: c.category, label: c.category, icon: categoryMeta(c.category).icon, count: c.count })),
    ];
  });

  readonly filtered = computed(() => {
    const q = this.search();
    const category = this.category();
    return this.store
      .objections()
      .filter((o) => category === ALL || o.category === category)
      .filter((o) => !this.favoritesOnly() || this.store.isFavorite('objections', o.id))
      .filter((o) => matchesQuery(q, o.objection, o.answer, o.category));
  });

  readonly hasAny = computed(() => this.store.objections().length > 0);

  /** New objections land in the category the admin is looking at. */
  readonly defaultCategory = computed(() => (this.category() === ALL ? '' : this.category()));

  toggle(o: Objection, open: boolean): void {
    this.openId.set(open ? o.id : null);
  }

  clearFilters(): void {
    this.search.set('');
    this.favoritesOnly.set(false);
    this.category.set(ALL);
  }

  remove(o: Objection): void {
    void this.actions.remove('objections', o.id, o.objection);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
