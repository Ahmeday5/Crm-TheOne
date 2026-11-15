import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** ISO-2 → path of the bundled 4×3 SVG flag (`flag-icons`, copied to `assets/flags` at build time). */
export function flagUrl(iso2: string | null | undefined): string | null {
  const code = iso2?.trim().toLowerCase();
  return code && /^[a-z]{2}$/.test(code) ? `assets/flags/${code}.svg` : null;
}

/**
 * A small country flag. Decorative by default (the country name sits next to
 * it); renders nothing for an unknown code or a missing file.
 */
@Component({
  selector: 'app-country-flag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as url) {
      @if (url !== brokenUrl()) {
        <img class="flag" [src]="url" [alt]="label() ?? ''" [attr.aria-hidden]="label() ? null : 'true'"
             loading="lazy" decoding="async" width="20" height="15" (error)="brokenUrl.set(url)" />
      }
    }
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; line-height: 0; }
    .flag {
      width: var(--flag-w, 1.25rem);
      height: auto;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 3px;
      box-shadow: 0 0 0 1px var(--border);
    }
  `,
})
export class CountryFlagComponent {
  readonly iso2 = input<string | null | undefined>(null);
  /** Accessible name when the flag stands alone (no visible country name). */
  readonly label = input<string | null>(null);

  protected readonly src = computed(() => flagUrl(this.iso2()));
  /** The URL that failed to load — a different country renders again. */
  protected readonly brokenUrl = signal<string | null>(null);
}
