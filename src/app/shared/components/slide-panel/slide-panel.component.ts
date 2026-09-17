import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  Renderer2,
  viewChild,
} from '@angular/core';

export type SlidePanelSize = 'sm' | 'md' | 'lg';
export type SlidePanelTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'orange';

let openCount = 0;

/**
 * Reusable side-drawer shell — same behavior contract as `app-modal`
 * (body scroll lock, Esc to close, backdrop click, autofocus) but slides in
 * from the edge of the screen instead of appearing centered. Follows the
 * inline-start edge via CSS `inset-inline-*`, so it slides from the right in
 * RTL (Arabic) and from the left in LTR automatically.
 *
 *   <app-slide-panel
 *     [open]="isOpen()"
 *     title="سجل التعديلات"
 *     icon="fa-solid fa-clock-rotate-left"
 *     iconTone="info"
 *     size="md"
 *     (closed)="isOpen.set(false)">
 *     <p>Body…</p>
 *   </app-slide-panel>
 */
@Component({
  selector: 'app-slide-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slide-panel.component.html',
  styleUrl: './slide-panel.component.scss',
})
export class SlidePanelComponent {
  readonly open = input.required<boolean>();
  readonly title = input<string>('');
  readonly icon = input<string>('');
  readonly iconTone = input<SlidePanelTone>('primary');
  readonly size = input<SlidePanelSize>('md');
  readonly closeOnEsc = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly showClose = input<boolean>(true);

  readonly closed = output<void>();

  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panel');

  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  private hasLockedBody = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.hasLockedBody) {
        this.lockBody();
      } else if (!isOpen && this.hasLockedBody) {
        this.unlockBody();
      }
    });

    effect(() => {
      if (!this.open()) return;
      queueMicrotask(() => this.panelEl()?.nativeElement?.focus());
    });

    this.destroyRef.onDestroy(() => {
      if (this.hasLockedBody) this.unlockBody();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (!this.open() || !this.closeOnEsc()) return;
    this.close();
  }

  protected onBackdropClick(): void {
    if (!this.closeOnBackdrop()) return;
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  private lockBody(): void {
    openCount += 1;
    if (openCount === 1) {
      this.renderer.addClass(document.body, 'app-modal-open');
    }
    this.hasLockedBody = true;
  }

  private unlockBody(): void {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
      this.renderer.removeClass(document.body, 'app-modal-open');
    }
    this.hasLockedBody = false;
  }
}
