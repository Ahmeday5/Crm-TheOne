import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

export type RatingStarsSize = 'sm' | 'md' | 'lg';

/**
 * 1–5 star rating.
 *
 * Read-only: a compact labelled image. Editable: an accessible radiogroup
 * (arrow keys / Home / End, roving tabindex) with hover preview and a pop
 * animation on the chosen star.
 */
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rating-stars.component.html',
  styleUrl: './rating-stars.component.scss',
})
export class RatingStarsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** 0 = not rated. */
  readonly value = input(0);
  readonly readonly = input(false);
  readonly size = input<RatingStarsSize>('md');
  /** Show the word for the current value ("ممتاز") next to the stars. */
  readonly showLabel = input(false);
  readonly valueChange = output<number>();

  readonly stars = [1, 2, 3, 4, 5] as const;
  readonly hover = signal(0);
  /** What the stars currently show — the hover preview wins while pointing. */
  readonly shown = computed(() => (this.readonly() ? 0 : this.hover()) || this.value());

  choose(n: number): void {
    if (this.readonly()) return;
    this.valueChange.emit(n);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.readonly()) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const current = this.value() || 0;
    const delta: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowUp: 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowDown: -1,
    };
    let next: number | null = null;
    if (event.key in delta) next = Math.min(5, Math.max(1, current + delta[event.key]));
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = 5;
    if (next === null) return;
    event.preventDefault();
    this.valueChange.emit(next);
    queueMicrotask(() =>
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next! - 1]?.focus(),
    );
  }
}
