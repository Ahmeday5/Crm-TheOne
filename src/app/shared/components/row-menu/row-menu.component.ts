import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface RowMenuItem {
  id: string;
  /** i18n key. */
  labelKey: string;
  icon: string;
  /** `danger` items are red and separated from the rest. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/**
 * "⋯" overflow menu for a table row — keeps rows to one or two visible actions.
 * The panel is `position: fixed` (computed from the button), so it is never
 * clipped by a scrolling table; it closes on outside click, Esc, scroll or
 * resize. Arrow keys move between items.
 */
@Component({
  selector: 'app-row-menu',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #trigger type="button" class="btn btn-sm btn-light rm-trigger"
            [attr.aria-label]="label() | translate" [title]="label() | translate"
            aria-haspopup="menu" [attr.aria-expanded]="open()" (click)="toggle()">
      <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
    </button>
    @if (open()) {
      <div #panel class="rm-panel" role="menu" [style.top.px]="pos().top" [style.left.px]="pos().left"
           (keydown)="onKey($event)">
        @for (item of items(); track item.id) {
          @if (item.tone === 'danger' && !$first) { <div class="rm-sep" role="separator"></div> }
          <button type="button" role="menuitem" class="rm-item" [class.is-danger]="item.tone === 'danger'"
                  [disabled]="item.disabled" (click)="pick(item)">
            <i [class]="item.icon" aria-hidden="true"></i>{{ item.labelKey | translate }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .rm-trigger { min-width: 32px; }
    .rm-panel {
      position: fixed;
      z-index: 1080;
      min-width: 11rem;
      padding: 0.3rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-0);
      box-shadow: var(--shadow-lg);
      animation: rm-in 120ms ease-out;
    }
    .rm-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-1);
      font-size: var(--fs-sm);
      text-align: start;
      white-space: nowrap;
    }
    .rm-item i { width: 1rem; text-align: center; color: var(--text-3); }
    .rm-item:hover:not(:disabled), .rm-item:focus-visible { background: var(--surface-2); outline: none; }
    .rm-item:disabled { opacity: 0.5; }
    .rm-item.is-danger, .rm-item.is-danger i { color: var(--danger); }
    .rm-sep { height: 1px; margin: 0.25rem 0; background: var(--border); }
    @keyframes rm-in { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .rm-panel { animation: none; } }
  `,
})
export class RowMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly items = input.required<RowMenuItem[]>();
  readonly label = input('common.moreActions');
  readonly select = output<string>();

  protected readonly open = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.open.set(false));
  }

  protected toggle(): void {
    if (this.open()) return this.close();
    this.place();
    this.open.set(true);
    queueMicrotask(() => this.focusItem(0));
  }

  protected pick(item: RowMenuItem): void {
    if (item.disabled) return;
    this.close();
    this.select.emit(item.id);
  }

  protected onKey(e: KeyboardEvent): void {
    const buttons = this.buttons();
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') this.focusItem((i + 1) % buttons.length);
    else if (e.key === 'ArrowUp') this.focusItem((i - 1 + buttons.length) % buttons.length);
    else return;
    e.preventDefault();
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (!this.open()) return;
    this.close();
    this.trigger().nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange(): void {
    if (this.open()) this.close();
  }

  private close(): void {
    this.open.set(false);
  }

  /** Below the button, aligned to its inline-end; flipped up / clamped to stay on screen. */
  private place(): void {
    const r = this.trigger().nativeElement.getBoundingClientRect();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const width = 184;
    const height = this.items().length * 38 + 16;
    let left = rtl ? r.left : r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const below = r.bottom + 4;
    const top = below + height > window.innerHeight ? Math.max(8, r.top - height - 4) : below;
    this.pos.set({ top, left });
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLButtonElement>('.rm-item:not(:disabled)') ?? []);
  }

  private focusItem(i: number): void {
    this.buttons()[i]?.focus();
  }
}
