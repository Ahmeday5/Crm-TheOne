import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookClipboardService } from '../../data/playbook-clipboard.service';

const FEEDBACK_MS = 1600;

/** One-click copy with a morphing check-mark confirmation. */
@Component({
  selector: 'app-pb-copy-button',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="pb-copy" [class.is-done]="done()" [class.is-compact]="compact()"
            [attr.aria-label]="'salesPlaybook.actions.copy' | translate"
            [title]="'salesPlaybook.actions.copy' | translate"
            (click)="copy($event)">
      <span class="pb-copy__ic" aria-hidden="true">
        <i class="fa-regular fa-copy pb-copy__a"></i>
        <i class="fa-solid fa-check pb-copy__b"></i>
      </span>
      @if (!compact()) {
        <span class="pb-copy__label">
          {{ (done() ? 'salesPlaybook.actions.copied' : 'salesPlaybook.actions.copy') | translate }}
        </span>
      }
    </button>
  `,
  styleUrl: './copy-button.component.scss',
})
export class CopyButtonComponent {
  readonly text = input.required<string>();
  /** Icon-only round button. */
  readonly compact = input(false);

  private readonly clipboard = inject(PlaybookClipboardService);
  protected readonly done = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.clipboard.copy(this.text()))) return;
    clearTimeout(this.timer);
    this.done.set(true);
    this.timer = setTimeout(() => this.done.set(false), FEEDBACK_MS);
  }
}
