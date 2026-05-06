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

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'orange';

let openCount = 0;

/**
 * Reusable modal shell.
 *
 *   <app-modal
 *     [open]="isOpen()"
 *     title="إضافة مستخدم"
 *     icon="fa-solid fa-user-plus"
 *     iconTone="primary"
 *     size="md"
 *     (closed)="isOpen.set(false)">
 *
 *     <p>Body…</p>
 *
 *     <ng-container modal-footer>
 *       <button class="btn btn-light" (click)="cancel()">إلغاء</button>
 *       <button class="btn btn-primary" (click)="save()">حفظ</button>
 *     </ng-container>
 *   </app-modal>
 *
 * Handles:
 *   - body scroll lock (multi-modal aware via shared open counter)
 *   - Esc to close (when `closeOnEsc`)
 *   - backdrop click to close (when `closeOnBackdrop`)
 *   - autofocus on open
 *   - emits `closed` on every dismissal pathway
 *
 * Theming:
 *   - All colors flow from `_tokens.scss` (`--surface-0`, `--border`, `--text-1`)
 *     so light/dark and brand-color switches Just Work.
 *   - The optional title icon uses the `.icon-tile.tone-*` utility classes.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  // ── inputs ──
  readonly open = input.required<boolean>();
  readonly title = input<string>('');
  readonly icon = input<string>('');
  readonly iconTone = input<ModalTone>('primary');
  readonly size = input<ModalSize>('md');
  readonly closeOnEsc = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly showClose = input<boolean>(true);
  readonly showHeader = input<boolean>(true);
  /** Hide the footer slot entirely (no border, no padding). */
  readonly showFooter = input<boolean>(true);

  // ── outputs ──
  readonly closed = output<void>();

  // ── refs ──
  private readonly dialogEl = viewChild<ElementRef<HTMLElement>>('dialog');

  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * True only while body has been locked by THIS modal instance. Plain field
   * — never read from the template, so writing it from inside `effect()`
   * doesn't trigger NG0600.
   */
  private hasLockedBody = false;

  constructor() {
    // Keep body scroll-lock state in sync with `open`.
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.hasLockedBody) {
        this.lockBody();
      } else if (!isOpen && this.hasLockedBody) {
        this.unlockBody();
      }
    });

    // Autofocus the dialog after it appears so Esc and tab work immediately.
    effect(() => {
      if (!this.open()) return;
      queueMicrotask(() => this.dialogEl()?.nativeElement?.focus());
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
