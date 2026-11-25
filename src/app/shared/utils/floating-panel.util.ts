import { signal } from '@angular/core';

export interface FloatingPanelOptions {
  /** Default / largest height of the scrollable list inside the panel (px). */
  listMax: number;
  /** Height of everything in the panel around the list: search box, footer… (px). */
  chrome: number;
  /** Gap between the trigger and the panel (px). */
  gap?: number;
  /**
   * Esc while open: called instead of letting the key reach other listeners,
   * so Esc closes the dropdown only, not the modal it sits in.
   */
  onEscape?: () => void;
}

/**
 * Makes a dropdown panel float over everything (modals, scroll containers):
 * while open, the panel element is moved to `<body>` and positioned `fixed`
 * under its trigger, or above it when there isn't room below. Keeps it in
 * place on scroll / resize. The list height is exposed as `--fp-list-max`.
 *
 * Usage: call `attach()` from a `@ViewChild('panel')` setter (with `undefined`
 * when the panel closes), `contains()` in the outside-click handler, and
 * `destroy()` on destroy. Angular still removes the node when its `@if` ends.
 */
export class FloatingPanel {
  /** The panel opens upwards. */
  readonly above = signal(false);

  private el: HTMLElement | null = null;
  private tracking = false;
  private readonly reposition = (): void => this.position();
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.options.onEscape) return;
    event.preventDefault();
    event.stopPropagation();
    this.options.onEscape();
  };

  constructor(
    private readonly trigger: () => Element | null,
    private readonly options: FloatingPanelOptions,
  ) {}

  attach(el: HTMLElement | null | undefined): void {
    this.el = el ?? null;
    if (!this.el) {
      this.untrack();
      return;
    }
    if (this.el.parentElement !== document.body) document.body.appendChild(this.el);
    this.position();
    this.track();
  }

  contains(node: Node): boolean {
    return !!this.el?.contains(node);
  }

  destroy(): void {
    this.untrack();
    this.el?.remove();
    this.el = null;
  }

  position(): void {
    const panel = this.el;
    const trigger = this.trigger();
    if (!panel || !trigger) return;

    const { listMax, chrome } = this.options;
    const gap = this.options.gap ?? 5;
    const margin = 8;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const below = viewportH - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const wanted = Math.min(panel.scrollHeight || listMax + chrome, listMax + chrome);
    const openAbove = below < wanted && above > below;
    const room = openAbove ? above : below;

    this.above.set(openAbove);
    panel.style.position = 'fixed';
    panel.style.left = `${rect.left}px`;
    panel.style.right = 'auto';
    panel.style.width = `${rect.width}px`;
    panel.style.setProperty('--fp-list-max', `${Math.max(120, Math.min(listMax, room - chrome))}px`);
    if (openAbove) {
      panel.style.top = 'auto';
      panel.style.bottom = `${viewportH - rect.top + gap}px`;
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = `${rect.bottom + gap}px`;
    }
  }

  private track(): void {
    if (this.tracking) return;
    this.tracking = true;
    // Capture: also catches scrolling inside modals and panels, not only the page.
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
    window.addEventListener('keydown', this.onKey, true);
  }

  private untrack(): void {
    if (!this.tracking) return;
    this.tracking = false;
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('keydown', this.onKey, true);
  }
}
