import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';

/** Writes text to the clipboard (async API, with a legacy fallback for non-secure origins). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;inset-inline-start:-9999px;opacity:0;';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.value = '';
  area.remove();
  return ok;
}

const FEEDBACK_MS = 1600;

/**
 * Icon button that copies a value and confirms with a check mark.
 * `value` may be a string or a function resolving it on demand — used for
 * secrets, which are fetched only at the moment of copying.
 */
@Component({
  selector: 'app-copy-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="cb" [class.is-done]="state() === 'done'" [class.is-busy]="state() === 'busy'"
            [disabled]="state() === 'busy'" [attr.title]="label()" [attr.aria-label]="label()" (click)="copy($event)">
      @switch (state()) {
        @case ('busy') { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
        @case ('done') { <i class="fa-solid fa-check" aria-hidden="true"></i> }
        @default { <i class="fa-regular fa-copy" aria-hidden="true"></i> }
      }
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .cb {
      display: inline-grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-3);
      transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
    }
    .cb:hover { background: var(--surface-2); color: var(--brand-500); }
    .cb:active { transform: scale(0.9); }
    .cb:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 1px; }
    .cb.is-done { color: var(--success); animation: cb-pop 260ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    @keyframes cb-pop { 40% { transform: scale(1.25); } }
    @media (prefers-reduced-motion: reduce) { .cb.is-done { animation: none; } }
  `,
})
export class CopyButtonComponent {
  readonly value = input.required<string | null | (() => Promise<string | null>)>();
  readonly label = input('');
  readonly copied = output<void>();
  readonly failed = output<void>();

  protected readonly state = signal<'idle' | 'busy' | 'done'>('idle');
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  protected async copy(event: Event): Promise<void> {
    event.stopPropagation();
    const source = this.value();
    this.state.set('busy');
    let text: string | null = null;
    try {
      text = typeof source === 'function' ? await source() : source;
    } catch {
      text = null;
    }
    const ok = !!text && (await copyToClipboard(text));
    text = null;
    if (!ok) {
      this.state.set('idle');
      this.failed.emit();
      return;
    }
    this.state.set('done');
    this.copied.emit();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state.set('idle'), FEEDBACK_MS);
  }
}
