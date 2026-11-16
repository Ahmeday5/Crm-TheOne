import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { VaultLockGateway } from '../../data/vault-lock-gateway';
import { VaultLockError, checkVaultPassword, isStrongEnough } from '../../models/vault-lock.models';
import { VaultSessionService } from '../../state/vault-session.service';

type Mode = 'loading' | 'setup' | 'unlock' | 'error';

/**
 * What stands in front of the vault.
 *  - No password yet → the admin creates one (twice, with live rules).
 *  - Otherwise → one field: the vault password. Wrong tries count down; too
 *    many lock the form for a while.
 * Success opens a short vault session (see `VaultSessionService`).
 */
@Component({
  selector: 'app-vault-lock-screen',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vault-lock-screen.component.html',
  styleUrl: './vault-lock-screen.component.scss',
})
export class VaultLockScreenComponent {
  private readonly gateway = inject(VaultLockGateway);
  private readonly session = inject(VaultSessionService);
  private readonly pwInput = viewChild<ElementRef<HTMLInputElement>>('pw');

  protected readonly mode = signal<Mode>('loading');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly reveal = signal(false);
  protected readonly busy = signal(false);
  /** i18n key of the current error, with its params. */
  protected readonly error = signal<{ key: string; n?: number } | null>(null);
  /** Lockout countdown (seconds). */
  protected readonly lockedFor = signal(0);
  /** Shown once when another admin set the password first. */
  protected readonly setupRaced = signal(false);

  protected readonly rules = computed(() => checkVaultPassword(this.password()));
  protected readonly matches = computed(() => !!this.confirm() && this.confirm() === this.password());
  protected readonly canSetup = computed(() => isStrongEnough(this.password()) && this.matches() && !this.busy());
  protected readonly canUnlock = computed(() => !!this.password() && !this.busy() && this.lockedFor() === 0);

  private lockTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadStatus();
    inject(DestroyRef).onDestroy(() => this.clearLockTimer());
    // Focus the password field whenever the form becomes usable.
    effect(() => {
      const m = this.mode();
      if (m === 'setup' || m === 'unlock') queueMicrotask(() => this.pwInput()?.nativeElement.focus());
    });
  }

  protected loadStatus(): void {
    this.mode.set('loading');
    this.gateway.status().subscribe({
      next: (s) => this.mode.set(s.isConfigured ? 'unlock' : 'setup'),
      error: () => this.mode.set('error'),
    });
  }

  protected submitSetup(): void {
    if (!this.canSetup()) return;
    this.run(this.gateway.setup(this.password()));
  }

  protected submitUnlock(): void {
    if (!this.canUnlock()) return;
    this.run(this.gateway.unlock(this.password()));
  }

  private run(call$: ReturnType<VaultLockGateway['unlock']>): void {
    this.busy.set(true);
    this.error.set(null);
    call$.subscribe({
      next: (result) => {
        this.busy.set(false);
        this.reset();
        this.session.open(result);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    const e = err instanceof VaultLockError ? err : new VaultLockError('unknown');
    switch (e.code) {
      case 'wrong':
        this.password.set('');
        this.error.set({ key: 'vaultLock.errors.wrong', n: e.attemptsLeft ?? undefined });
        this.pwInput()?.nativeElement.focus();
        break;
      case 'lockedOut':
        this.password.set('');
        this.startLockout(e.retryAfterSec ?? 60);
        break;
      case 'alreadyConfigured':
        this.reset();
        this.setupRaced.set(true);
        this.mode.set('unlock');
        break;
      case 'notConfigured':
        this.reset();
        this.mode.set('setup');
        break;
      case 'weak':
        this.error.set({ key: 'vaultLock.errors.weak' });
        break;
      default:
        this.error.set({ key: 'vaultLock.errors.generic' });
    }
  }

  private startLockout(seconds: number): void {
    this.clearLockTimer();
    this.error.set(null);
    this.lockedFor.set(seconds);
    this.lockTimer = setInterval(() => {
      const left = this.lockedFor() - 1;
      this.lockedFor.set(Math.max(0, left));
      if (left <= 0) {
        this.clearLockTimer();
        queueMicrotask(() => this.pwInput()?.nativeElement.focus());
      }
    }, 1000);
  }

  private clearLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }

  private reset(): void {
    this.password.set('');
    this.confirm.set('');
    this.reveal.set(false);
    this.error.set(null);
  }
}
