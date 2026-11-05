import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { SEQUENCE_TIMEOUT_MS, SHORTCUTS } from '../config/shortcuts.const';
import { CommandCenterUiService } from './command-center-ui.service';
import { CommandRegistryService } from './command-registry.service';
import { TourService } from './tour.service';

/** Arabic keyboard layout → the Latin key on the same physical key. */
const ARABIC_TO_LATIN: Record<string, string> = {
  'ى': 'n', 'ل': 'g', 'ح': 'p', 'ص': 'w', 'ؤ': 'c', 'ش': 'a', 'ا': 'h', '؟': '?',
};

/**
 * Global keyboard shortcuts.
 *
 *   Ctrl/⌘+K  command palette (works everywhere, even while typing)
 *   N         new customer
 *   G then P  sales pipeline · G W WhatsApp · G C team chat · G A announcements · G H home
 *   ?         shortcut cheat-sheet
 *
 * Plain-key shortcuts are ignored while typing, inside dialogs, or with a
 * modifier held, so they never hijack normal input. Works with an Arabic
 * keyboard layout too (physical key mapping).
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ui = inject(CommandCenterUiService);
  private readonly registry = inject(CommandRegistryService);
  private readonly tour = inject(TourService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Keys typed so far in an unfinished sequence (shown as a hint chip). */
  readonly pending = signal<string[]>([]);
  private timer?: ReturnType<typeof setTimeout>;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this.onKeydown(e));
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.auth.isAuthenticated() || e.isComposing) return;

    // Ctrl/⌘+K — always available.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
      e.preventDefault();
      this.ui.togglePalette();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.ui.paletteOpen() || this.ui.helpOpen() || this.tour.active()) return;
    if (this.isTyping(e.target) || this.dialogOpen()) return;

    const key = this.normalizeKey(e);
    if (!key) return;

    const sequence = [...this.pending(), key];
    const exact = SHORTCUTS.find((s) => s.keys.join(' ') === sequence.join(' '));
    const isPrefix = SHORTCUTS.some(
      (s) => s.keys.length > sequence.length && s.keys.slice(0, sequence.length).join(' ') === sequence.join(' '),
    );

    if (exact) {
      e.preventDefault();
      this.reset();
      this.run(exact.commandId);
    } else if (isPrefix) {
      e.preventDefault();
      this.pending.set(sequence);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.reset(), SEQUENCE_TIMEOUT_MS);
    } else if (this.pending().length) {
      // Broken sequence — retry the key on its own (e.g. "g x n" → "n").
      this.reset();
      this.onKeydown(e);
    }
  }

  private run(commandId: string): void {
    const ok = this.registry.execute(this.registry.byId(commandId));
    if (!ok) {
      this.toast.warning(resolveKey(TRANSLATIONS[this.language.lang()], 'commandCenter.notAvailable'));
    }
  }

  private normalizeKey(e: KeyboardEvent): string | null {
    if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) return '?';
    if (e.key.length !== 1) return null;
    const k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) return k;
    if (ARABIC_TO_LATIN[e.key]) return ARABIC_TO_LATIN[e.key];
    // Any other layout: fall back to the physical key.
    const m = /^Key([A-Z])$/.exec(e.code);
    return m ? m[1].toLowerCase() : null;
  }

  private isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  private dialogOpen(): boolean {
    return !!document.querySelector('.app-modal-backdrop, .modal.show, [role="dialog"][aria-modal="true"]');
  }

  private reset(): void {
    clearTimeout(this.timer);
    this.pending.set([]);
  }
}
