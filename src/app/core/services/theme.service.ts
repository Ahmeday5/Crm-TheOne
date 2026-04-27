import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export type ColorScheme = 'blue' | 'purple' | 'green';

const THEME_KEY = 'crm.theme';
const COLOR_KEY = 'crm.color';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');
  readonly color = signal<ColorScheme>('blue');

  constructor(@Inject(DOCUMENT) private doc: Document) {
    const savedMode = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'light';
    const savedColor = (localStorage.getItem(COLOR_KEY) as ColorScheme | null) ?? 'blue';
    this.applyMode(savedMode);
    this.applyColor(savedColor);
  }

  setMode(mode: ThemeMode): void {
    this.applyMode(mode);
    localStorage.setItem(THEME_KEY, mode);
  }

  toggleMode(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setColor(color: ColorScheme): void {
    this.applyColor(color);
    localStorage.setItem(COLOR_KEY, color);
  }

  private applyMode(mode: ThemeMode): void {
    this.doc.documentElement.setAttribute('data-theme', mode);
    this.mode.set(mode);
  }

  private applyColor(color: ColorScheme): void {
    this.doc.documentElement.setAttribute('data-color', color);
    this.color.set(color);
  }
}
