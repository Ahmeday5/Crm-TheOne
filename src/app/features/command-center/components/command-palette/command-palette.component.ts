import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppCommand, CommandGroup } from '../../models/command.models';
import { CommandCenterUiService } from '../../services/command-center-ui.service';
import { CommandRegistryService } from '../../services/command-registry.service';
import { searchCommands } from '../../utils/command-search.util';

interface ResultSection {
  group: CommandGroup;
  items: { command: AppCommand; flatIndex: number }[];
}

/**
 * Ctrl/⌘+K command palette — jump to any page or run any action, searching
 * Arabic and English at once. Full keyboard support (↑ ↓ Enter Esc, Home/End).
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  protected readonly ui = inject(CommandCenterUiService);
  private readonly registry = inject(CommandRegistryService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  readonly query = signal('');
  readonly activeIndex = signal(0);

  readonly sections = computed<ResultSection[]>(() => {
    const q = this.query().trim();
    const sections: ResultSection[] = [];
    let flat = 0;
    const push = (group: CommandGroup, commands: AppCommand[]) => {
      if (!commands.length) return;
      sections.push({ group, items: commands.map((command) => ({ command, flatIndex: flat++ })) });
    };

    if (!q) {
      const recent = this.registry.recent();
      const recentIds = new Set(recent.map((c) => c.id));
      push('recent', recent);
      const rest = this.registry.commands().filter((c) => !recentIds.has(c.id));
      push('actions', rest.filter((c) => c.group === 'actions'));
      push('pages', rest.filter((c) => c.group === 'pages'));
      return sections;
    }

    const hits = searchCommands(this.registry.index(), q).map((r) => r.command);
    push('pages', hits.filter((c) => c.group === 'pages'));
    push('actions', hits.filter((c) => c.group === 'actions'));
    return sections;
  });

  readonly flat = computed(() => this.sections().flatMap((s) => s.items.map((i) => i.command)));
  readonly isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);

  constructor() {
    // Fresh state + focus every time it opens.
    effect(() => {
      if (!this.ui.paletteOpen()) return;
      untracked(() => {
        this.query.set('');
        this.activeIndex.set(0);
        afterNextRender(() => this.input()?.nativeElement.focus(), { injector: this.injector });
      });
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onKeydown(e: KeyboardEvent): void {
    const count = this.flat().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (count) this.move((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (count) this.move((this.activeIndex() - 1 + count) % count);
        break;
      case 'Home':
        if (count) { e.preventDefault(); this.move(0); }
        break;
      case 'End':
        if (count) { e.preventDefault(); this.move(count - 1); }
        break;
      case 'Enter':
        e.preventDefault();
        this.run(this.flat()[this.activeIndex()]);
        break;
      case 'Escape':
        e.preventDefault();
        this.ui.closePalette();
        break;
    }
  }

  run(command: AppCommand | undefined): void {
    if (!command) return;
    this.ui.closePalette();
    this.registry.execute(command);
  }

  context(command: AppCommand): string {
    return command.contextKey ? resolveKey(TRANSLATIONS[this.language.lang()], command.contextKey) : '';
  }

  private move(index: number): void {
    this.activeIndex.set(index);
    afterNextRender(
      () =>
        this.list()
          ?.nativeElement.querySelector<HTMLElement>(`[data-index="${index}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      { injector: this.injector },
    );
  }
}
