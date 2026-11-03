import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Whether the user is actually looking at this tab: visible AND focused.
 *
 * Drives "mark read only while focused" and "no toast for the chat that is
 * already open in front of the user".
 */
@Injectable({ providedIn: 'root' })
export class WindowFocusService {
  private readonly zone = inject(NgZone);
  private readonly state = signal(this.read());

  /** `true` while the tab is visible and has focus. */
  readonly focused = this.state.asReadonly();

  constructor() {
    if (typeof window === 'undefined') return;
    const update = () => {
      const next = this.read();
      if (next !== this.state()) this.zone.run(() => this.state.set(next));
    };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('focus', update);
      window.addEventListener('blur', update);
      document.addEventListener('visibilitychange', update);
    });
  }

  private read(): boolean {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible' && document.hasFocus();
  }
}
