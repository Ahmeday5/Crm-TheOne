import { ChangeDetectionStrategy, Component, ElementRef, effect, input, signal, viewChild } from '@angular/core';

/**
 * Renders `data` as a QR code on a canvas (the `qrcode` lib is lazy-loaded, so
 * it costs nothing until a QR is shown). Dark modules use the text colour on a
 * white quiet zone so phones scan it in both themes.
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr" [style.--qr.px]="size()" [class.is-ready]="ready()">
      <canvas #canvas [attr.aria-label]="label()" role="img"></canvas>
      @if (!ready()) { <span class="qr__sk" aria-hidden="true"></span> }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .qr {
      position: relative; width: var(--qr); height: var(--qr); padding: 10px;
      border-radius: var(--radius-lg); background: #fff; border: 1px solid var(--border);
      box-sizing: content-box;
    }
    canvas { width: 100% !important; height: 100% !important; display: block; opacity: 0; transition: opacity 300ms ease; }
    .qr.is-ready canvas { opacity: 1; }
    .qr__sk { position: absolute; inset: 10px; border-radius: var(--radius-md); background: var(--surface-2); animation: qr-pulse 1.2s ease-in-out infinite; }
    @keyframes qr-pulse { 50% { opacity: 0.5; } }
    @media (prefers-reduced-motion: reduce) { .qr__sk { animation: none; } canvas { transition: none; } }
  `,
})
export class QrCodeComponent {
  readonly data = input.required<string>();
  readonly size = input(168);
  readonly label = input('QR');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly ready = signal(false);

  constructor() {
    effect(() => {
      const data = this.data();
      const size = this.size();
      const canvas = this.canvas().nativeElement;
      this.ready.set(false);
      if (!data) return;
      import('qrcode')
        .then((qr) =>
          qr.toCanvas(canvas, data, {
            width: size * 2,
            margin: 0,
            errorCorrectionLevel: 'M',
            color: { dark: '#0f172a', light: '#ffffff' },
          }),
        )
        .then(() => this.ready.set(true))
        .catch(() => this.ready.set(false));
    }, { allowSignalWrites: true });
  }
}
