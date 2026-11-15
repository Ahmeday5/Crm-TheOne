/**
 * The map's colours, derived from the live design tokens so they follow the
 * theme (light / dark) and the brand scheme (blue / purple / green).
 *
 * Magnitude is ONE hue, light → dark: each step is a solid mix of
 * `--brand-500` into the card surface (no gradients — every region gets one
 * flat colour). Zero stays a neutral grey, never the lightest brand step.
 */

export interface MapPalette {
  /** Sequential steps, low → high. */
  steps: string[];
  /** Regions without customers. */
  empty: string;
  /** Region outlines — the card surface, so shapes read as separated fills. */
  outline: string;
  /** Outline of the hovered / selected region. */
  accent: string;
  text: string;
  textMuted: string;
  surface: string;
  font: string;
}

type Rgb = [number, number, number];

export function parseColor(value: string): Rgb | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** `weight` of `b` over `a` (0 → a, 1 → b), as `#rrggbb`. */
export function mixColors(a: string, b: string, weight: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return b;
  const w = Math.min(1, Math.max(0, weight));
  return `#${ca.map((x, i) => Math.round(x + (cb[i] - x) * w).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Five-step ramps, checked with the dataviz palette validator (`--ordinal`)
 * for all three brand schemes: one hue, monotone lightness, visible gaps
 * between steps, and the faintest step clears the card surface (≥ 2:1).
 *   light: surface → brand → near-black   (more customers = darker)
 *   dark:  deep brand → brand → near-white (more customers = brighter)
 */
function ramp(surface: string, brand: string, dark: boolean): string[] {
  return dark
    ? [
        mixColors(brand, surface, 0.15),
        mixColors(brand, '#ffffff', 0.2),
        mixColors(brand, '#ffffff', 0.42),
        mixColors(brand, '#ffffff', 0.62),
        mixColors(brand, '#ffffff', 0.8),
      ]
    : [
        mixColors(surface, brand, 0.6),
        mixColors(surface, brand, 0.8),
        brand,
        mixColors(brand, '#000000', 0.28),
        mixColors(brand, '#000000', 0.52),
      ];
}

export function buildMapPalette(tokens: (name: string) => string, dark: boolean, stepCount = 5): MapPalette {
  const surface = tokens('--surface-0') || (dark ? '#1a2236' : '#ffffff');
  const brand = tokens('--brand-500') || '#0066cc';
  const full = ramp(surface, brand, dark);
  // Fewer buckets: keep both ends and spread the rest evenly.
  const steps =
    stepCount >= full.length
      ? full
      : stepCount <= 1
        ? [full[full.length - 1]]
        : Array.from({ length: stepCount }, (_, i) => full[Math.round((i * (full.length - 1)) / (stepCount - 1))]);

  return {
    steps,
    empty: tokens('--surface-3') || (dark ? '#232c42' : '#e2e8f0'),
    outline: surface,
    // Hover / selection is an ink outline, not another fill (fills encode counts).
    accent: tokens('--text-1') || (dark ? '#e2e8f0' : '#0f172a'),
    text: tokens('--text-1') || (dark ? '#e2e8f0' : '#0f172a'),
    textMuted: tokens('--text-2') || (dark ? '#94a3b8' : '#475569'),
    surface,
    font: tokens('--ff-base') || 'inherit',
  };
}

/** Reads the current tokens off `:root`. */
export function readMapPalette(doc: Document, stepCount: number): MapPalette {
  const style = getComputedStyle(doc.documentElement);
  const dark = doc.documentElement.getAttribute('data-theme') === 'dark';
  return buildMapPalette((name) => style.getPropertyValue(name).trim(), dark, stepCount);
}
