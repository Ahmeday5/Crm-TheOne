/**
 * Loads MapLibre GL on first use — the library, its stylesheet and its web
 * worker — so none of it touches the main bundle.
 *
 * - The CSS and the worker are copied from `node_modules/maplibre-gl/dist`
 *   to `assets/vendor/maplibre` at build time (angular.json).
 * - The worker is handed to MapLibre as a Blob URL: that works whatever MIME
 *   type the production server gives `.mjs` files.
 * - Arabic labels render natively in MapLibre 6 (no RTL plugin).
 */

export type MapLibre = typeof import('maplibre-gl');

const ASSET_DIR = 'assets/vendor/maplibre';
let loading: Promise<MapLibre> | null = null;

export function loadMapLibre(doc: Document): Promise<MapLibre> {
  loading ??= (async () => {
    injectStylesheet(doc, `${ASSET_DIR}/maplibre-gl.css`);
    const lib = await import('maplibre-gl');
    const workerUrl = new URL(`${ASSET_DIR}/maplibre-gl-worker.mjs`, doc.baseURI).href;
    try {
      const source = await fetch(workerUrl).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      });
      lib.setWorkerUrl(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    } catch {
      lib.setWorkerUrl(workerUrl); // MapLibre loads it itself (needs a JS MIME type on the server).
    }
    return lib;
  })().catch((err) => {
    loading = null; // a later visit retries (e.g. after a deploy or offline blip)
    throw err;
  });
  return loading;
}

function injectStylesheet(doc: Document, href: string): void {
  if (doc.head.querySelector(`link[data-maplibre]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['maplibre'] = '';
  doc.head.appendChild(link);
}

/**
 * Basemaps: OpenFreeMap vector tiles (OpenStreetMap data) — free, no API key,
 * no usage limits; attribution is added by the style itself.
 */
export const BASEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/** Framing for each level ([west, south], [east, north]). */
export const VIEW_BOUNDS = {
  world: [[-110, -38], [150, 62]] as [[number, number], [number, number]],
  egypt: [[24.6, 21.9], [36.95, 31.75]] as [[number, number], [number, number]],
} as const;
