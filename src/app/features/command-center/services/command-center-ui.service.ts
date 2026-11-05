import { Injectable, signal } from '@angular/core';

/** Open/closed state of the command-center overlays (palette, shortcut help). */
@Injectable({ providedIn: 'root' })
export class CommandCenterUiService {
  readonly paletteOpen = signal(false);
  readonly helpOpen = signal(false);

  openPalette(): void {
    this.helpOpen.set(false);
    this.paletteOpen.set(true);
  }

  closePalette(): void {
    this.paletteOpen.set(false);
  }

  togglePalette(): void {
    this.paletteOpen() ? this.closePalette() : this.openPalette();
  }

  openHelp(): void {
    this.paletteOpen.set(false);
    this.helpOpen.set(true);
  }

  closeHelp(): void {
    this.helpOpen.set(false);
  }
}
