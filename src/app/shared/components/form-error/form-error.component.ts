import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { firstError, firstErrorAlways } from '../../utils/form-validation.util';

/**
 * Renders the most relevant validation message for a given control.
 *
 *   <app-form-error [control]="form.controls.email" label="البريد الإلكتروني" />
 *
 * Stays empty while the control is pristine + untouched, so the form
 * doesn't shout at the user before they've interacted. Pass `[forceShow]="true"`
 * after a submit attempt (or call `form.markAllAsTouched()` on the form,
 * which is generally cleaner).
 *
 * ── Why the manual `tick` signal? ──────────────────────────────────────
 * `AbstractControl.errors / touched / dirty` are plain mutable properties,
 * not signals — so a `computed()` over the bound control alone would never
 * re-run when the user types or blurs. We subscribe to the control's
 * `events` stream (Angular 18+) and bump a counter signal on each event,
 * giving the `message` computed the reactive dependency it needs.
 */
@Component({
  selector: 'app-form-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as msg) {
      <div class="invalid-feedback d-block app-form-error">
        <i class="fa-solid fa-circle-exclamation me-1"></i>{{ msg }}
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .app-form-error {
        font-size: var(--fs-xs);
        color: var(--danger);
        margin-top: 0.25rem;
        line-height: 1.4;
      }
    `,
  ],
})
export class FormErrorComponent {
  readonly control = input.required<AbstractControl | null | undefined>();
  readonly label = input.required<string>();
  /** Force-show even before the user has touched the field (e.g. after submit). */
  readonly forceShow = input<boolean>(false);
  /** Optional custom validators to localized-message resolvers. */
  readonly custom = input<Record<string, (e: unknown) => string> | undefined>(undefined);

  private readonly language = inject(LanguageService);

  /** Bumped on every status/value/touched/dirty change of the bound control. */
  private readonly tick = signal(0);

  constructor() {
    effect(
      (onCleanup) => {
        const ctrl = this.control();
        if (!ctrl) return;
        const sub = ctrl.events.subscribe(() => {
          this.tick.update((v) => v + 1);
        });
        onCleanup(() => sub.unsubscribe());
      },
      { allowSignalWrites: true },
    );
  }

  protected readonly message = computed<string | null>(() => {
    this.tick(); // reactive dependency
    const ctrl = this.control();
    if (!ctrl) return null;
    const lang = this.language.lang();
    return this.forceShow()
      ? firstErrorAlways(ctrl, this.label(), lang, this.custom())
      : firstError(ctrl, this.label(), lang, this.custom());
  });
}
