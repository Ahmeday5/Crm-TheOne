import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent, interval } from 'rxjs';

/** The non-standard `beforeinstallprompt` event (Chromium / Edge / Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Re-check for a new deployment every 30 minutes while the app is open. */
const UPDATE_CHECK_MS = 30 * 60_000;

/**
 * Installability + update lifecycle of the PWA.
 *
 *   - `canInstall`  → the browser offered an install prompt we can trigger
 *     from our own UI (user menu / Ctrl+K) instead of the default mini-bar.
 *   - `updateReady` → a new version was downloaded; `applyUpdate()` reloads.
 *
 * Inert in dev builds (the service worker is only enabled in production).
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly sw = inject(SwUpdate);
  private readonly destroyRef = inject(DestroyRef);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly installable = signal(false);
  private readonly installed = signal(this.detectStandalone());

  readonly canInstall = computed(() => this.installable() && !this.installed());
  readonly isStandalone = this.installed.asReadonly();
  readonly updateReady = signal(false);

  private started = false;

  /** Called once by the shell. */
  start(): void {
    if (this.started) return;
    this.started = true;

    fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        event.preventDefault();
        this.deferredPrompt = event;
        this.installable.set(true);
      });

    fromEvent(window, 'appinstalled')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.deferredPrompt = null;
        this.installable.set(false);
        this.installed.set(true);
      });

    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateReady.set(true));

    // A broken cache can't recover by itself — reload onto a clean state.
    this.sw.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => document.location.reload());

    interval(UPDATE_CHECK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.sw.checkForUpdate().catch(() => undefined));
  }

  /** Shows the native install dialog. Resolves `true` when accepted. */
  async install(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;
    this.deferredPrompt = null;
    this.installable.set(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      document.location.reload();
    }
  }

  dismissUpdate(): void {
    this.updateReady.set(false);
  }

  private detectStandalone(): boolean {
    return (
      (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }
}
