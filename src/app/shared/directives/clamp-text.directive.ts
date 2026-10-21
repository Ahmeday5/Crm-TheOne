import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  HostListener,
  NgZone,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { TextPreviewService } from '../../core/services/text-preview.service';

/**
 * Clamps long text to N lines and, only when it actually overflows, turns
 * the element into a button that opens the full text in a small dialog.
 *
 *   <p appClampText>{{ ticket.description }}</p>
 *   <p [appClampText]="3" [clampTitle]="ticket.title">{{ ticket.description }}</p>
 *   <span appClampText="1" [clampText]="row.notes">{{ row.notes }}</span>
 *
 * - `appClampText`  visible lines (default 2);
 * - `clampTitle`    dialog heading (optional);
 * - `clampText`     full text when it differs from what is rendered
 *                   (defaults to the element's own text).
 *
 * Overflow is re-measured whenever the box or its text changes, so the
 * affordance stays correct across breakpoints and language switches. Clicks
 * on a clamped element don't bubble, so it is safe inside clickable rows.
 */
@Directive({
  selector: '[appClampText]',
  standalone: true,
  host: {
    class: 'clamp-text',
    '[style.--clamp-lines]': 'lines()',
    '[class.is-clamped]': 'clamped()',
    '[attr.role]': 'clamped() ? "button" : null',
    '[attr.tabindex]': 'clamped() ? 0 : null',
    '[attr.aria-haspopup]': 'clamped() ? "dialog" : null',
  },
})
export class ClampTextDirective implements AfterViewInit {
  readonly lines = input(2, {
    alias: 'appClampText',
    transform: (v: unknown) => numberAttribute(v, 2) || 2,
  });
  readonly clampTitle = input<string | null | undefined>('');
  readonly clampText = input<string | null | undefined>(null);

  protected readonly clamped = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preview = inject(TextPreviewService);

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const el = this.host.nativeElement;
    this.zone.runOutsideAngular(() => {
      // Size changes (viewport, fonts) and content changes (a longer text
      // can still clamp to the same box height) both affect overflow.
      const resize = new ResizeObserver(() => this.measure());
      const content = new MutationObserver(() => this.measure());
      resize.observe(el);
      content.observe(el, { childList: true, subtree: true, characterData: true });
      this.destroyRef.onDestroy(() => {
        resize.disconnect();
        content.disconnect();
      });
    });
  }

  @HostListener('click', ['$event'])
  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  protected open(event: Event): void {
    if (!this.clamped()) return;
    event.preventDefault();
    event.stopPropagation();
    this.preview.open({
      title: this.clampTitle() || undefined,
      text: this.clampText() ?? this.host.nativeElement.innerText,
    });
  }

  private measure(): void {
    const el = this.host.nativeElement;
    const overflowing =
      el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1;
    if (overflowing !== this.clamped()) {
      this.zone.run(() => this.clamped.set(overflowing));
    }
  }
}
