import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuickReply } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { matchesQuery } from '../../utils/arabic-text.util';
import { categoryMeta } from '../../utils/playbook.util';

export const SALES_PLAYBOOK_PATH = '/sales-playbook';

/**
 * Lightning-bolt button + popover listing the playbook's quick replies.
 * Emits the chosen reply's raw text (placeholders untouched) — the host
 * decides how to insert it. Favourites come first; ↑/↓ + Enter work from
 * the search box.
 *
 *   <app-quick-reply-picker [disabled]="disabled()" (picked)="insert($event)" />
 */
@Component({
  selector: 'app-quick-reply-picker',
  standalone: true,
  imports: [TranslatePipe, ClickOutsideDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-reply-picker.component.html',
  styleUrl: './quick-reply-picker.component.scss',
})
export class QuickReplyPickerComponent {
  readonly disabled = input(false);
  readonly picked = output<string>();

  private readonly store = inject(SalesPlaybookStore);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly loading = computed(() => this.store.loading() && !this.store.loaded());
  protected readonly error = computed(() => this.store.error() && !this.store.loaded());
  protected readonly isAdmin = this.store.canManage;
  protected readonly playbookPath = SALES_PLAYBOOK_PATH;

  protected readonly results = computed(() => {
    const q = this.query();
    return this.store.replies().filter((r) => matchesQuery(q, r.title, r.text, r.category));
  });

  protected icon(r: QuickReply): string {
    return categoryMeta(r.category).icon;
  }

  protected isFavorite(r: QuickReply): boolean {
    return this.store.isFavorite('replies', r.id);
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    if (this.disabled()) return;
    this.store.start();
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    queueMicrotask(() => this.searchBox()?.nativeElement.focus());
  }

  protected close(): void {
    this.open.set(false);
  }

  protected retry(): void {
    this.store.refresh();
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected choose(r: QuickReply): void {
    this.picked.emit(r.text);
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!count) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.set((this.active() + step + count) % count);
        this.scrollActiveIntoView();
        break;
      }
      case 'Enter': {
        const r = this.results()[this.active()];
        if (!r || event.isComposing) return;
        event.preventDefault();
        this.choose(r);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
    }
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() =>
      this.list()
        ?.nativeElement.querySelector<HTMLElement>('.qr-item.is-active')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
