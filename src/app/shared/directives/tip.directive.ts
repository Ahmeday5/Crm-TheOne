import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';

/**
 * Lightweight tooltip directive — renders a floating `.app-tip` div directly
 * on `document.body` (position:fixed) so it is never clipped by a parent's
 * `overflow:hidden`, even inside scrollable table cells.
 *
 * Usage:
 *   <span class="clip-text" [appTip]="row.campaignName">{{ row.campaignName }}</span>
 *
 * The tooltip appears above the host element, flips below when there is no
 * room, and is clamped to the viewport horizontally.
 * Dismissed automatically on mouseleave, scroll, resize, or host destruction.
 */
@Directive({
  selector: '[appTip]',
  standalone: true,
})
export class TipDirective implements OnDestroy {
  @Input('appTip') text = '';

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private tipEl: HTMLElement | null = null;
  private rafId = 0;

  @HostListener('mouseenter')
  show(): void {
    if (!this.text?.trim()) return;
    this.create();
  }

  @HostListener('mouseleave')
  hide(): void {
    this.destroy();
  }

  @HostListener('window:scroll', ['$event'])
  @HostListener('window:resize')
  onScrollOrResize(): void {
    this.destroy();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private create(): void {
    this.destroy();

    const tip = document.createElement('div');
    tip.className = 'app-tip';
    tip.textContent = this.text;
    document.body.appendChild(tip);
    this.tipEl = tip;

    // Wait one frame so the browser has measured the element's dimensions.
    this.rafId = requestAnimationFrame(() => this.position());
  }

  private position(): void {
    const tip = this.tipEl;
    if (!tip) return;

    const rect = this.host.nativeElement.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const gap = 8;
    const margin = 8;

    // Prefer above; flip to below when there is not enough room.
    let top = rect.top - tipH - gap;
    if (top < margin) top = rect.bottom + gap;

    // Centre horizontally over the host; clamp to viewport edges.
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tipW - margin));

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    tip.style.opacity = '1';
    tip.style.transform = 'translateY(0)';
  }

  private destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.tipEl?.remove();
    this.tipEl = null;
  }
}
