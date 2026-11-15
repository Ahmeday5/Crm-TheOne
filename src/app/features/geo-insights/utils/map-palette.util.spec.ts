import { buildMapPalette, mixColors, parseColor } from './map-palette.util';

describe('map palette', () => {
  it('parses hex and rgb colours', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#0066cc')).toEqual([0, 102, 204]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('var(--x)')).toBeNull();
  });

  it('mixes solid colours', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#ffffff', '#0066cc', 0)).toBe('#ffffff');
    expect(mixColors('#ffffff', '#0066cc', 1)).toBe('#0066cc');
  });

  const tokens: Record<string, string> = { '--surface-0': '#ffffff', '--brand-500': '#0066cc', '--surface-3': '#e2e8f0' };

  it('uses the validated light ramp (light → dark) and a neutral for zero', () => {
    const p = buildMapPalette((n) => tokens[n] ?? '', false);
    expect(p.steps).toEqual(['#66a3e0', '#3385d6', '#0066cc', '#004993', '#003162']);
    expect(p.empty).toBe('#e2e8f0');
    expect(p.steps).not.toContain(p.empty);
  });

  it('keeps both ends when fewer buckets are needed', () => {
    const p = buildMapPalette((n) => tokens[n] ?? '', false, 3);
    expect(p.steps).toEqual(['#66a3e0', '#0066cc', '#003162']);
    expect(buildMapPalette((n) => tokens[n] ?? '', false, 1).steps).toEqual(['#003162']);
  });

  it('brightens with magnitude in dark mode', () => {
    const p = buildMapPalette((n) => ({ ...tokens, '--surface-0': '#1a2236' })[n] ?? '', true);
    expect(p.steps[p.steps.length - 1]).toBe(mixColors('#0066cc', '#ffffff', 0.8));
  });
});
