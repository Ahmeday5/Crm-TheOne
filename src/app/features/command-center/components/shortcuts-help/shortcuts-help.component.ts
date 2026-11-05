import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SHORTCUTS } from '../../config/shortcuts.const';
import { CommandCenterUiService } from '../../services/command-center-ui.service';

/** "?" cheat-sheet — renders straight from `SHORTCUTS`, so it can't drift. */
@Component({
  selector: 'app-shortcuts-help',
  standalone: true,
  imports: [ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.helpOpen()) {
      <app-modal [open]="true" [title]="'commandCenter.help.title' | translate" icon="fa-regular fa-keyboard"
                 size="md" [showFooter]="false" (closed)="ui.closeHelp()">
        <p class="sh-intro">{{ 'commandCenter.help.intro' | translate }}</p>
        <ul class="sh-list">
          <li [style.--i]="0">
            <span>{{ 'commandCenter.shortcuts.palette' | translate }}</span>
            <span class="sh-keys"><kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd><span class="sh-plus">+</span><kbd>K</kbd></span>
          </li>
          @for (s of shortcuts; track s.id; let i = $index) {
            <li [style.--i]="i + 1">
              <span>{{ s.labelKey | translate }}</span>
              <span class="sh-keys">
                @for (k of s.keys; track $index; let last = $last) {
                  <kbd>{{ k.toUpperCase() }}</kbd>
                  @if (!last) { <span class="sh-then">{{ 'commandCenter.help.then' | translate }}</span> }
                }
              </span>
            </li>
          }
        </ul>
        <p class="sh-note"><i class="fa-solid fa-circle-info"></i>{{ 'commandCenter.help.note' | translate }}</p>
      </app-modal>
    }
  `,
  styles: [`
    .sh-intro { color: var(--text-2); margin-bottom: 1rem; }
    .sh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .sh-list li {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.6rem 0.75rem; border-radius: var(--radius-md);
      animation: sh-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--i, 0) * 35ms);
      transition: background-color 0.15s ease;
    }
    .sh-list li:hover { background: var(--surface-2); }
    .sh-keys { display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0; direction: ltr; }
    .sh-then, .sh-plus { font-size: var(--fs-xs); color: var(--text-3); }
    kbd {
      display: inline-grid; place-items: center; min-width: 1.8rem; height: 1.8rem; padding: 0 0.45rem;
      border: 1px solid var(--border); border-bottom-width: 3px; border-radius: var(--radius-sm);
      background: var(--surface-1); color: var(--text-1); font-family: inherit; font-size: var(--fs-xs); font-weight: var(--fw-700);
    }
    .sh-note { display: flex; gap: 0.5rem; margin: 1rem 0 0; font-size: var(--fs-xs); color: var(--text-3); }
    .sh-note i { color: var(--info); margin-top: 0.15rem; }
    @keyframes sh-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .sh-list li { animation: none; } }
  `],
})
export class ShortcutsHelpComponent {
  protected readonly ui = inject(CommandCenterUiService);
  readonly shortcuts = SHORTCUTS;
  readonly isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}
