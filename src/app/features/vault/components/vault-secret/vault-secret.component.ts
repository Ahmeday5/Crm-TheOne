import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { VaultService } from '../../services/vault.service';

/** How long a revealed password stays on screen. */
export const REVEAL_SECONDS = 30;

/**
 * The password cell: `••••••••` + reveal + copy.
 *
 * - Reveal calls `GET /Vault/{id}/password` on click, shows it for
 *   {@link REVEAL_SECONDS} s (with a countdown ring), then drops it.
 * - Copy fetches on demand and discards it right after writing the clipboard.
 * - The password lives only in this component's signal while visible — never
 *   in a store, the HTTP cache or storage — and is cleared on destroy.
 */
@Component({
  selector: 'app-vault-secret',
  standalone: true,
  imports: [TranslatePipe, CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hasPassword()) {
      <span class="vs__none">—</span>
    } @else {
      <span class="vs" [class.is-revealed]="!!secret()">
        <code class="vs__value" dir="ltr" [attr.aria-live]="secret() ? 'polite' : null">
          {{ secret() ?? '••••••••' }}
        </code>
        <button type="button" class="vs__btn" (click)="toggle()" [disabled]="loading()"
                [attr.title]="(secret() ? 'vault.secret.hide' : 'vault.secret.show') | translate"
                [attr.aria-label]="(secret() ? 'vault.secret.hide' : 'vault.secret.show') | translate"
                [attr.aria-pressed]="!!secret()">
          @if (loading()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          } @else if (secret()) {
            <svg class="vs__ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle class="vs__ring-track" cx="18" cy="18" r="15" />
              <circle class="vs__ring-time" cx="18" cy="18" r="15" [style.animation-duration.s]="seconds" />
            </svg>
            <i class="fa-regular fa-eye-slash" aria-hidden="true"></i>
          } @else {
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
          }
        </button>
        <app-copy-button [value]="copySource" [label]="'vault.secret.copy' | translate"
                         (copied)="copied.emit()" (failed)="failed.emit()" />
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .vs { display: inline-flex; align-items: center; gap: 0.15rem; }
    .vs__none { color: var(--text-muted); }
    .vs__value {
      min-width: 6.5rem;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text-2);
      font-size: var(--fs-sm);
      letter-spacing: 0.08em;
      white-space: nowrap;
      transition: background-color 200ms ease, color 200ms ease;
    }
    .is-revealed .vs__value {
      background: var(--warning-soft);
      color: var(--text-1);
      letter-spacing: 0.02em;
      user-select: all;
      animation: vs-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .vs__btn {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-3);
      transition: background-color 150ms ease, color 150ms ease;
    }
    .vs__btn:hover { background: var(--surface-2); color: var(--brand-500); }
    .vs__btn:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 1px; }
    .vs__ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .vs__ring circle { fill: none; stroke-width: 2.5; }
    .vs__ring-track { stroke: var(--surface-3); }
    .vs__ring-time {
      stroke: var(--warning);
      stroke-linecap: round;
      stroke-dasharray: 94.25;
      animation: vs-countdown linear forwards;
    }
    @keyframes vs-countdown { to { stroke-dashoffset: 94.25; } }
    @keyframes vs-in { from { opacity: 0; filter: blur(3px); } }
    @media (prefers-reduced-motion: reduce) { .is-revealed .vs__value { animation: none; } }
  `,
})
export class VaultSecretComponent {
  private readonly vault = inject(VaultService);

  readonly accountId = input.required<number>();
  readonly hasPassword = input(true);
  readonly copied = output<void>();
  readonly failed = output<void>();
  /** The reveal request failed (the parent shows the API message). */
  readonly revealFailed = output<unknown>();

  protected readonly seconds = REVEAL_SECONDS;
  protected readonly secret = signal<string | null>(null);
  protected readonly loading = signal(false);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  /** Fetched at click time and handed straight to the clipboard. */
  protected readonly copySource = (): Promise<string | null> =>
    this.secret()
      ? Promise.resolve(this.secret())
      : firstValueFrom(this.vault.revealPassword(this.accountId())).catch((err) => {
          this.revealFailed.emit(err);
          return null;
        });

  protected toggle(): void {
    if (this.secret()) {
      this.hide();
      return;
    }
    this.loading.set(true);
    this.vault.revealPassword(this.accountId()).subscribe({
      next: (password) => {
        this.loading.set(false);
        this.secret.set(password);
        this.hideTimer = setTimeout(() => this.hide(), REVEAL_SECONDS * 1000);
      },
      error: (err) => {
        this.loading.set(false);
        this.revealFailed.emit(err);
      },
    });
  }

  private hide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.secret.set(null);
  }
}
