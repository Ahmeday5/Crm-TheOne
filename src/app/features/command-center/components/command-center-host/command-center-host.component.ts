import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { PwaService } from '../../../../core/pwa/pwa.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts.service';
import { TourService } from '../../services/tour.service';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';
import { ProductTourComponent } from '../product-tour/product-tour.component';
import { ShortcutsHelpComponent } from '../shortcuts-help/shortcuts-help.component';

/** Let the first page settle before the welcome tour appears. */
const TOUR_DELAY_MS = 1500;

/**
 * Single mount point (in the main layout) for app-wide productivity UI:
 * Ctrl+K palette, shortcut help, onboarding tour, the pending-sequence hint
 * and the "new version" prompt. Also boots the shortcut + PWA services.
 */
@Component({
  selector: 'app-command-center',
  standalone: true,
  imports: [TranslatePipe, CommandPaletteComponent, ShortcutsHelpComponent, ProductTourComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-command-palette />
    <app-shortcuts-help />
    <app-product-tour />

    @if (shortcuts.pending().length) {
      <div class="cc-seq" role="status" aria-live="polite">
        @for (k of shortcuts.pending(); track $index) { <kbd>{{ k.toUpperCase() }}</kbd> }
        <span class="cc-seq-dots"><i></i><i></i><i></i></span>
      </div>
    }

    @if (pwa.updateReady()) {
      <div class="cc-update" role="status">
        <span class="cc-update-ic"><i class="fa-solid fa-arrows-rotate"></i></span>
        <span class="cc-update-text">
          <strong>{{ 'commandCenter.pwa.updateTitle' | translate }}</strong>
          <small>{{ 'commandCenter.pwa.updateBody' | translate }}</small>
        </span>
        <button type="button" class="btn btn-sm btn-primary" (click)="pwa.applyUpdate()">
          {{ 'commandCenter.pwa.updateNow' | translate }}
        </button>
        <button type="button" class="cc-update-close" (click)="pwa.dismissUpdate()"
                [attr.aria-label]="'commandCenter.pwa.later' | translate">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    }
  `,
  styles: [`
    kbd {
      display: inline-grid; place-items: center; min-width: 1.7rem; height: 1.7rem; padding: 0 0.4rem;
      border: 1px solid var(--border); border-bottom-width: 3px; border-radius: var(--radius-sm);
      background: var(--surface-0); color: var(--text-1); font-family: inherit; font-size: var(--fs-xs); font-weight: 700;
    }
    .cc-seq {
      position: fixed; bottom: calc(1.25rem + var(--bottom-offset, 0px)); left: 50%; transform: translateX(-50%); z-index: 2050;
      display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.75rem;
      border: 1px solid var(--border); border-radius: var(--radius-pill);
      background: var(--surface-0); box-shadow: var(--shadow-lg); direction: ltr;
      animation: cc-up 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .cc-seq-dots { display: inline-flex; gap: 3px; }
    .cc-seq-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--brand-500); animation: cc-dot 1s infinite; }
    .cc-seq-dots i:nth-child(2) { animation-delay: 0.15s; }
    .cc-seq-dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cc-dot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
    @keyframes cc-up { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

    .cc-update {
      position: fixed; bottom: calc(1.25rem + var(--bottom-offset, 0px)); inset-inline-start: 1.25rem; z-index: 2040;
      display: flex; align-items: center; gap: 0.75rem; max-width: min(440px, calc(100vw - 2.5rem));
      padding: 0.75rem 0.85rem; border: 1px solid var(--border); border-inline-start: 4px solid var(--brand-500);
      border-radius: var(--radius-lg); background: var(--surface-0); box-shadow: var(--shadow-lg);
      animation: cc-slide 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .cc-update-ic {
      display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%;
      background: var(--brand-soft); color: var(--brand-500);
    }
    .cc-update-ic i { animation: cc-spin 2.4s linear infinite; }
    .cc-update-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .cc-update-text small { color: var(--text-3); }
    .cc-update-close { border: 0; background: transparent; color: var(--text-3); padding: 0.25rem; }
    .cc-update-close:hover { color: var(--text-1); }
    @keyframes cc-slide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    @keyframes cc-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .cc-seq, .cc-update, .cc-seq-dots i, .cc-update-ic i { animation: none; }
    }
  `],
})
export class CommandCenterHostComponent implements OnInit {
  protected readonly shortcuts = inject(KeyboardShortcutsService);
  protected readonly pwa = inject(PwaService);
  private readonly tour = inject(TourService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.shortcuts.start();
    this.pwa.start();

    if (this.tour.shouldAutoStart()) {
      const timer = setTimeout(() => this.tour.start(), TOUR_DELAY_MS);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    }
  }
}
