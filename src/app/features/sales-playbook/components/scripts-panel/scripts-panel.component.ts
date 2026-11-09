import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CallScript } from '../../models/sales-playbook.models';
import { PlaybookActionsService } from '../../state/playbook-actions.service';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { matchesQuery } from '../../utils/arabic-text.util';
import { CallModeDialogComponent } from '../call-mode-dialog/call-mode-dialog.component';
import { FilterChip, FilterChipsComponent } from '../filter-chips/filter-chips.component';
import { PanelToolbarComponent } from '../panel-toolbar/panel-toolbar.component';
import { ScriptCardComponent } from '../script-card/script-card.component';
import { ScriptFormDialogComponent } from '../script-form-dialog/script-form-dialog.component';

const ALL = 'all';
const GENERIC = 'generic';

@Component({
  selector: 'app-pb-scripts-panel',
  standalone: true,
  imports: [
    TranslatePipe,
    EmptyStateComponent,
    PanelToolbarComponent,
    FilterChipsComponent,
    ScriptCardComponent,
    ScriptFormDialogComponent,
    CallModeDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scripts-panel.component.html',
  styleUrl: '../playbook-panel.scss',
})
export class ScriptsPanelComponent {
  private readonly store = inject(SalesPlaybookStore);
  private readonly actions = inject(PlaybookActionsService);
  private readonly language = inject(LanguageService);

  readonly isAdmin = this.store.canManage;
  readonly busyId = this.actions.busyId;

  readonly search = signal('');
  readonly favoritesOnly = signal(false);
  readonly service = signal<string>(ALL);

  /** `undefined` closed, `null` create, value edit. */
  readonly editing = signal<CallScript | null | undefined>(undefined);
  readonly calling = signal<CallScript | null>(null);

  /** One chip per linked service (+ "general"), only when there's something to choose. */
  readonly chips = computed<FilterChip[]>(() => {
    const scripts = this.store.scripts();
    const en = this.language.lang() === 'en';
    const byService = new Map<string, FilterChip>();
    for (const s of scripts) {
      const value = s.service ? String(s.service.id) : GENERIC;
      const chip = byService.get(value);
      if (chip) {
        chip.count = (chip.count ?? 0) + 1;
        continue;
      }
      const label = s.service
        ? (en ? s.service.nameEn || s.service.nameAr : s.service.nameAr || s.service.nameEn)
        : this.t('salesPlaybook.scripts.generic');
      byService.set(value, { value, label, count: 1 });
    }
    if (byService.size < 2) return [];
    return [
      { value: ALL, label: this.t('salesPlaybook.filters.all'), count: scripts.length, icon: 'fa-solid fa-layer-group' },
      ...byService.values(),
    ];
  });

  readonly filtered = computed(() => {
    const q = this.search();
    const service = this.service();
    return this.store
      .scripts()
      .filter((s) => service === ALL || (s.service ? String(s.service.id) : GENERIC) === service)
      .filter((s) => !this.favoritesOnly() || this.store.isFavorite('scripts', s.id))
      .filter((s) =>
        matchesQuery(q, s.title, s.service?.nameAr, s.service?.nameEn, s.opening, s.closing, ...s.steps),
      );
  });

  readonly hasAny = computed(() => this.store.scripts().length > 0);

  clearFilters(): void {
    this.search.set('');
    this.favoritesOnly.set(false);
    this.service.set(ALL);
  }

  remove(s: CallScript): void {
    void this.actions.remove('scripts', s.id, s.title);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
