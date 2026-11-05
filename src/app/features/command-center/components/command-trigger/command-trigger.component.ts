import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CommandCenterUiService } from '../../services/command-center-ui.service';

/** Header search pill that opens the palette (and teaches the shortcut). */
@Component({
  selector: 'app-command-trigger',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="ctr" data-tour="search" (click)="ui.openPalette()"
            [attr.aria-label]="'commandCenter.palette.placeholder' | translate"
            [title]="'commandCenter.palette.placeholder' | translate">
      <i class="fa-solid fa-magnifying-glass"></i>
      <span class="ctr-text">{{ 'commandCenter.trigger' | translate }}</span>
      <span class="ctr-keys"><kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd><kbd>K</kbd></span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ctr {
      display: inline-flex; align-items: center; gap: 0.6rem; height: 38px; min-width: 220px;
      padding: 0 0.5rem 0 0.85rem; padding-inline: 0.85rem 0.45rem;
      border: 1px solid var(--border); border-radius: var(--radius-pill);
      background: var(--surface-1); color: var(--text-3); font-size: var(--fs-sm);
      transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    }
    .ctr:hover { border-color: var(--brand-500); background: var(--surface-0); color: var(--text-2); box-shadow: 0 0 0 3px var(--brand-soft); }
    .ctr:hover i { color: var(--brand-500); transform: scale(1.1); }
    .ctr i { transition: transform 0.2s ease, color 0.2s ease; }
    .ctr-text { flex: 1; text-align: start; white-space: nowrap; }
    .ctr-keys { display: inline-flex; gap: 0.2rem; direction: ltr; }
    kbd {
      display: inline-grid; place-items: center; min-width: 1.4rem; height: 1.4rem; padding: 0 0.3rem;
      border: 1px solid var(--border); border-bottom-width: 2px; border-radius: var(--radius-sm);
      background: var(--surface-0); color: var(--text-2); font-family: inherit; font-size: 0.68rem; font-weight: 600;
    }
    @media (max-width: 991.98px) {
      .ctr { min-width: 0; width: 38px; padding: 0; justify-content: center; }
      .ctr-text, .ctr-keys { display: none; }
    }
  `],
})
export class CommandTriggerComponent {
  protected readonly ui = inject(CommandCenterUiService);
  readonly isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}
