import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { VaultUnlockResult } from '../models/vault-lock.models';

/**
 * The open vault "session": the unlock token and when it expires.
 *
 * Memory only — never storage. A refresh, a new tab, logging out or the
 * expiry time all lock the vault again; whoever sits at the screen next must
 * know the vault password.
 */
@Injectable({ providedIn: 'root' })
export class VaultSessionService {
  private readonly auth = inject(AuthService);

  private readonly tokenSig = signal<string | null>(null);
  private readonly expiresAtSig = signal<number>(0);
  /** Ticks every second while unlocked (drives the countdown + auto-lock). */
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Why the vault last locked by itself — `expired` (time ran out),
   * a server reason (`vault_token_expired`, `vault_locked`, …) or `null`
   * (manual lock / fresh visit). Lets the lock screen explain.
   */
  readonly lockReason = signal<string | null>(null);

  readonly token = this.tokenSig.asReadonly();
  readonly isUnlocked = computed(() => !!this.tokenSig() && this.expiresAtSig() > this.now());
  /** Seconds until auto-lock (0 when locked). */
  readonly secondsLeft = computed(() =>
    this.isUnlocked() ? Math.max(0, Math.ceil((this.expiresAtSig() - this.now()) / 1000)) : 0,
  );

  /** Only identity matters — a profile refresh (name, photo) must not lock the vault. */
  private readonly userId = computed(() => this.auth.currentUser()?.userId ?? null);

  constructor() {
    // Signing out (or switching user) always locks the vault.
    effect(() => {
      this.userId();
      untracked(() => this.lock());
    });

    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  open(result: VaultUnlockResult): void {
    const expires = Date.parse(result.expiresAt);
    this.tokenSig.set(result.vaultToken);
    this.expiresAtSig.set(Number.isFinite(expires) ? expires : Date.now() + 15 * 60_000);
    this.now.set(Date.now());
    this.lockReason.set(null);
    this.startTimer();
  }

  /** Drop the token. `reason` is shown on the lock screen (omit for a manual lock). */
  lock(reason: string | null = null): void {
    const wasOpen = !!this.tokenSig();
    this.tokenSig.set(null);
    this.expiresAtSig.set(0);
    this.stopTimer();
    if (wasOpen || reason) this.lockReason.set(reason);
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (!this.isUnlocked()) this.lock('expired');
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
