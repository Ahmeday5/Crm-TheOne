import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, fromEvent, merge } from 'rxjs';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TourService } from '../../services/tour.service';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 14;
const MARGIN = 12;
const PAD = 6;

/**
 * Spotlight onboarding tour. The highlighted element is cut out of a dimmed
 * overlay (one element with a huge solid box-shadow, so the "hole" animates
 * smoothly between steps) and the step card is placed beside it, clamped to
 * the viewport. Missing/hidden targets fall back to a centred card.
 */
@Component({
  selector: 'app-product-tour',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-tour.component.html',
  styleUrl: './product-tour.component.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class ProductTourComponent {
  protected readonly tour = inject(TourService);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');

  /** Spotlight rectangle (viewport coords) — null = centred step. */
  readonly hole = signal<Box | null>(null);
  private readonly cardSize = signal({ width: 360, height: 220 });
  private readonly viewport = signal({ width: window.innerWidth, height: window.innerHeight });

  readonly cardPos = computed(() => {
    const hole = this.hole();
    const { width: cw, height: ch } = this.cardSize();
    const { width: vw, height: vh } = this.viewport();
    if (!hole) return { top: Math.max(MARGIN, (vh - ch) / 2), left: Math.max(MARGIN, (vw - cw) / 2), placement: 'center' };

    const clampLeft = (x: number) => Math.min(Math.max(MARGIN, x), vw - cw - MARGIN);
    const clampTop = (y: number) => Math.min(Math.max(MARGIN, y), vh - ch - MARGIN);
    const centerX = hole.left + hole.width / 2 - cw / 2;
    const centerY = hole.top + hole.height / 2 - ch / 2;

    if (hole.top + hole.height + GAP + ch <= vh - MARGIN) {
      return { top: hole.top + hole.height + GAP, left: clampLeft(centerX), placement: 'bottom' };
    }
    if (hole.top - GAP - ch >= MARGIN) {
      return { top: hole.top - GAP - ch, left: clampLeft(centerX), placement: 'top' };
    }
    // Tall targets (the sidebar): beside it, on whichever side has room.
    if (hole.left + hole.width + GAP + cw <= vw - MARGIN) {
      return { top: clampTop(centerY), left: hole.left + hole.width + GAP, placement: 'side' };
    }
    if (hole.left - GAP - cw >= MARGIN) {
      return { top: clampTop(centerY), left: hole.left - GAP - cw, placement: 'side' };
    }
    return { top: clampTop(vh - ch - MARGIN), left: clampLeft(centerX), placement: 'bottom' };
  });

  constructor() {
    effect(() => {
      const step = this.tour.step();
      const active = this.tour.active();
      untracked(() => {
        if (!active || !step) return;
        this.locate(step.target, true);
        afterNextRender(() => this.measureCard(), { injector: this.injector });
      });
    });

    merge(fromEvent(window, 'resize'), fromEvent(window, 'scroll', { capture: true }))
      .pipe(auditTime(60), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.tour.active()) return;
        this.viewport.set({ width: window.innerWidth, height: window.innerHeight });
        this.locate(this.tour.step()?.target, false);
        this.measureCard();
      });
  }

  onKey(e: KeyboardEvent): void {
    if (!this.tour.active()) return;
    const rtl = this.language.lang() === 'ar';
    if (e.key === 'Escape') { e.preventDefault(); this.tour.finish(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.tour.next(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); rtl ? this.tour.prev() : this.tour.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rtl ? this.tour.next() : this.tour.prev(); }
  }

  private locate(target: string | undefined, scroll: boolean): void {
    const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
    const rect = el?.getBoundingClientRect();
    const visible =
      !!el && !!rect && rect.width > 0 && rect.height > 0 && el.offsetParent !== null &&
      getComputedStyle(el).visibility !== 'hidden';

    if (!visible || !el) {
      this.hole.set(null);
      return;
    }
    if (scroll) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Very tall targets (sidebar) are clipped to the viewport.
    const top = Math.max(r.top - PAD, 4);
    const bottom = Math.min(r.bottom + PAD, vh - 4);
    this.hole.set({ top, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - top) });
  }

  private measureCard(): void {
    const el = this.card()?.nativeElement;
    if (el) this.cardSize.set({ width: el.offsetWidth, height: el.offsetHeight });
  }
}
