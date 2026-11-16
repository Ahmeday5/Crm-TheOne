import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MlMap,
  MapLayerMouseEvent,
  Popup,
} from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import { MapLevel } from '../../models/geo.models';
import type { GeoJson } from '../../services/geo-boundaries.service';
import { escapeHtml } from '../../utils/geo.util';
import { MapPalette } from '../../utils/map-palette.util';
import { BASEMAP_STYLES, MapLibre, VIEW_BOUNDS, loadMapLibre } from '../../map/maplibre.loader';

/** A shaped region (country / governorate) and its fill. `key` = GeoJSON feature name. */
export interface GeoRegionDatum {
  key: string;
  value: number;
  color: string;
}

/** A point where there is no shape (tiny country / no boundary file), or a hotspot ring. */
export interface GeoBubbleDatum {
  key: string;
  lng: number;
  lat: number;
  value: number;
  color: string;
  /** Pulsing ring — reserved for the few largest markets. */
  pulse?: boolean;
}

/**
 * One individual record (e.g. a single customer) dropped as a small dot. Never
 * clustered: 100 customers in Cairo are 100 dots (GL circles stay fast into
 * the thousands).
 */
export interface GeoPointDatum {
  /** Stable id — used as the popup key and for click-through. */
  id: number;
  lng: number;
  lat: number;
  /** Primary label (name). */
  label: string;
  /** Optional one-line sub label (status, city…). */
  sub?: string;
}

const SRC_REGIONS = 'geo-regions';
const SRC_BUBBLES = 'geo-bubbles';
const SRC_POINTS = 'geo-points';
const L_FILL = 'geo-regions-fill';
const L_LINE = 'geo-regions-line';
const L_SELECTED = 'geo-regions-selected';
const L_PULSE = 'geo-bubbles-pulse';
const L_BUBBLES = 'geo-bubbles';
const L_POINTS = 'geo-points';
const MIN_RADIUS = 7;
const MAX_RADIUS = 22;
const FLY_MS = 1800;

/**
 * A real, zoomable map (MapLibre GL + OpenFreeMap / OpenStreetMap tiles)
 * with the counts painted on top: each region with records gets one flat
 * colour from the sequential scale, *under* the basemap's place names so the
 * map still reads like a map. Regions without records stay plain basemap.
 *
 * - Lazy: library, stylesheet and worker load on first render (own chunk).
 * - One map instance for the page's life — switching World ⇄ Egypt swaps the
 *   data and flies the camera, it never rebuilds the map.
 * - Light / dark basemap follows the app theme; labels in Arabic or English.
 * - Ctrl + wheel to zoom (no hijacked page scroll); two fingers on touch.
 * - Hover popup + click → `regionClick(key)`; selection = ink outline.
 * - `prefers-reduced-motion`: no flights, no pulsing rings.
 */
@Component({
  selector: 'app-geo-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #canvas class="gm__canvas" role="region" [attr.aria-label]="ariaLabel()"></div>
    @if (state() !== 'ready') {
      <div class="gm__overlay" [class.is-error]="state() === 'error'" aria-live="polite">
        @if (state() === 'error') {
          <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>
          <span>{{ errorText() }}</span>
        } @else {
          <span class="gm__radar" aria-hidden="true"></span>
        }
      </div>
    }
  `,
  styleUrl: './geo-map.component.scss',
})
export class GeoMapComponent {
  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  readonly level = input<MapLevel>('world');
  /** Shapes for the level; `null` = unavailable (bubbles only). */
  readonly geo = input<GeoJson | null>(null);
  readonly regions = input<GeoRegionDatum[]>([]);
  readonly bubbles = input<GeoBubbleDatum[]>([]);
  /** Individual records as clustered pins (e.g. one customer each). */
  readonly points = input<GeoPointDatum[]>([]);
  readonly palette = input.required<MapPalette>();
  readonly dark = input(false);
  readonly lang = input<'ar' | 'en'>('ar');
  readonly selectedKey = input<string | null>(null);
  /** Popup HTML for a key (the caller escapes its values). */
  readonly tooltip = input<(key: string) => string>(() => '');
  readonly ariaLabel = input('');
  readonly errorText = input('');

  readonly regionClick = output<string>();
  /** A clustered pin was clicked (its `id`). */
  readonly pointClick = output<number>();

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly styleReady = signal(0);

  private lib: MapLibre | null = null;
  private map: MlMap | null = null;
  private popup: Popup | null = null;
  private hovered: string | null = null;
  private appliedStyle: string | null = null;
  private flownLevel: MapLevel | null = null;
  private pulseFrame = 0;
  private observer?: ResizeObserver;
  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    afterNextRender(() => {
      loadMapLibre(this.doc)
        .then((lib) => this.zone.runOutsideAngular(() => this.create(lib)))
        .catch(() => this.state.set('error'));
    });

    // Data / colours / selection → sources (once the style is in).
    effect(() => {
      if (!this.styleReady()) return;
      const payload = {
        geo: this.geo(),
        regions: this.regions(),
        bubbles: this.bubbles(),
        points: this.points(),
        palette: this.palette(),
        selected: this.selectedKey(),
      };
      untracked(() => this.zone.runOutsideAngular(() => this.sync(payload)));
    });

    // Level → camera.
    effect(() => {
      const level = this.level();
      if (!this.styleReady()) return;
      untracked(() => this.zone.runOutsideAngular(() => this.frame(level)));
    });

    // Theme → basemap style (the layers are re-added on `style.load`).
    effect(() => {
      const url = this.dark() ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light;
      this.lang();
      untracked(() => {
        if (this.map && url !== this.appliedStyle) {
          this.appliedStyle = url;
          this.map.setStyle(url, { diff: false });
        } else if (this.map && this.map.isStyleLoaded()) {
          this.localizeLabels();
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.pulseFrame);
      this.observer?.disconnect();
      this.popup?.remove();
      this.map?.remove();
      this.map = null;
    });
  }

  // ─────────── setup ───────────

  private create(lib: MapLibre): void {
    this.lib = lib;
    const ar = this.lang() === 'ar';
    this.appliedStyle = this.dark() ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light;
    let map: MlMap;
    try {
      map = new lib.Map({
        container: this.canvas().nativeElement,
        style: this.appliedStyle,
        bounds: VIEW_BOUNDS[this.level()],
        fitBoundsOptions: { padding: 24 },
        minZoom: 0.8,
        maxZoom: 10,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        cooperativeGestures: true,
        attributionControl: { compact: true, customAttribution: 'Boundaries: Natural Earth · geoBoundaries (CC BY 4.0)' },
        locale: ar
          ? {
              'CooperativeGesturesHandler.WindowsHelpText': 'استخدم Ctrl + عجلة الماوس للتكبير والتصغير',
              'CooperativeGesturesHandler.MacHelpText': 'استخدم ⌘ + عجلة الماوس للتكبير والتصغير',
              'CooperativeGesturesHandler.MobileHelpText': 'استخدم إصبعين لتحريك الخريطة',
              'NavigationControl.ZoomIn': 'تكبير',
              'NavigationControl.ZoomOut': 'تصغير',
              'FullscreenControl.Enter': 'ملء الشاشة',
              'FullscreenControl.Exit': 'الخروج من ملء الشاشة',
            }
          : undefined,
      });
    } catch {
      this.zone.run(() => this.state.set('error')); // no WebGL
      return;
    }
    this.map = map;
    this.flownLevel = this.level();
    map.addControl(new lib.NavigationControl({ showCompass: false }), ar ? 'top-left' : 'top-right');
    map.addControl(new lib.FullscreenControl(), ar ? 'top-left' : 'top-right');
    this.popup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: '300px', className: 'geo-popup' });

    map.on('style.load', () => {
      this.localizeLabels();
      this.addLayers();
      this.zone.run(() => {
        this.styleReady.update((n) => n + 1);
        this.state.set('ready');
      });
    });
    map.on('error', () => undefined); // tile hiccups must not surface as page errors

    for (const layer of [L_FILL, L_BUBBLES]) {
      map.on('mousemove', layer, (e) => this.onHover(e));
      map.on('mouseleave', layer, () => this.clearHover());
      map.on('click', layer, (e) => {
        const key = this.keyOf(e);
        if (key) this.zone.run(() => this.regionClick.emit(key));
      });
    }

    // Individual pins: hover popup, click → open that record.
    map.on('mousemove', L_POINTS, (e) => this.onPinHover(e));
    map.on('mouseleave', L_POINTS, () => this.clearHover());
    map.on('click', L_POINTS, (e) => {
      const id = e.features?.[0]?.properties?.['id'];
      if (typeof id === 'number') this.zone.run(() => this.pointClick.emit(id));
    });

    this.observer = new ResizeObserver(() => map.resize());
    this.observer.observe(this.canvas().nativeElement);
  }

  /** Place names in the UI language (falls back to the local name). */
  private localizeLabels(): void {
    const map = this.map;
    if (!map) return;
    const field = ['coalesce', ['get', this.lang() === 'ar' ? 'name:ar' : 'name:en'], ['get', 'name']] as ExpressionSpecification;
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout && !layer.id.startsWith('geo-')) {
        map.setLayoutProperty(layer.id, 'text-field', field);
      }
    }
  }

  /** Our layers go under the basemap's first label layer: colours below, names on top. */
  private addLayers(): void {
    const map = this.map;
    if (!map) return;
    const firstLabel = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
    const empty = { type: 'FeatureCollection', features: [] } as FeatureCollection;

    map.addSource(SRC_REGIONS, { type: 'geojson', data: empty, promoteId: 'key' });
    map.addSource(SRC_BUBBLES, { type: 'geojson', data: empty, promoteId: 'key' });
    map.addSource(SRC_POINTS, { type: 'geojson', data: empty, promoteId: 'id' });

    map.addLayer(
      {
        id: L_FILL,
        type: 'fill',
        source: SRC_REGIONS,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.92, 0.74],
          'fill-opacity-transition': { duration: 180 },
        },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: L_LINE,
        type: 'line',
        source: SRC_REGIONS,
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], ['get', 'ink'], ['get', 'outline']],
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.6, 0.7],
        },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: L_SELECTED,
        type: 'line',
        source: SRC_REGIONS,
        filter: ['==', ['get', 'key'], ''],
        paint: { 'line-color': ['get', 'ink'], 'line-width': 2.6 },
      },
      firstLabel,
    );
    map.addLayer({
      id: L_PULSE,
      type: 'circle',
      source: SRC_BUBBLES,
      filter: ['==', ['get', 'pulse'], true],
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0,
      },
    });
    map.addLayer({
      id: L_BUBBLES,
      type: 'circle',
      source: SRC_BUBBLES,
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], ['*', ['get', 'radius'], 1.15], ['get', 'radius']],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': ['get', 'outline'],
        'circle-stroke-width': ['case', ['==', ['get', 'key'], ['get', 'selected']], 3, 2],
        'circle-radius-transition': { duration: 160 },
      },
    });

    // Individual pins sit *above* the basemap labels — they're the foreground
    // subject, not part of the choropleth that reads as the map. One small dot
    // per customer, never merged into a bigger circle.
    map.addLayer({
      id: L_POINTS,
      type: 'circle',
      source: SRC_POINTS,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          6, ['case', ['boolean', ['feature-state', 'hover'], false], 4, 2.5],
          9, ['case', ['boolean', ['feature-state', 'hover'], false], 5.5, 3.5],
          12, ['case', ['boolean', ['feature-state', 'hover'], false], 7, 5],
        ],
        'circle-color': this.palette().accent,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    });
    this.startPulse();
  }

  // ─────────── data ───────────

  private sync(p: {
    geo: GeoJson | null;
    regions: GeoRegionDatum[];
    bubbles: GeoBubbleDatum[];
    points: GeoPointDatum[];
    palette: MapPalette;
    selected: string | null;
  }): void {
    const map = this.map;
    if (!map?.getSource(SRC_REGIONS)) return;
    const byKey = new Map(p.regions.map((r) => [r.key, r]));
    const regions: FeatureCollection = {
      type: 'FeatureCollection',
      features: (p.geo?.features ?? [])
        .filter((f) => byKey.has(f.properties.name))
        .map((f) => {
          const r = byKey.get(f.properties.name)!;
          return {
            type: 'Feature',
            geometry: f.geometry as Geometry,
            properties: { key: r.key, count: r.value, color: r.color, outline: p.palette.outline, ink: p.palette.accent },
          };
        }),
    };
    const max = Math.max(1, ...p.bubbles.map((b) => b.value));
    const bubbles: FeatureCollection = {
      type: 'FeatureCollection',
      features: p.bubbles.map((b) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
        properties: {
          key: b.key,
          count: b.value,
          color: b.color,
          outline: b.key === p.selected ? p.palette.accent : p.palette.outline,
          selected: p.selected ?? '',
          pulse: !!b.pulse && !this.reducedMotion,
          radius: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(b.value / max),
        },
      })),
    };
    const points: FeatureCollection = {
      type: 'FeatureCollection',
      features: p.points.map((pt) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
        properties: { id: pt.id, label: pt.label, sub: pt.sub ?? '' },
      })),
    };

    (map.getSource(SRC_REGIONS) as GeoJSONSource).setData(regions);
    (map.getSource(SRC_BUBBLES) as GeoJSONSource).setData(bubbles);
    (map.getSource(SRC_POINTS) as GeoJSONSource).setData(points);
    map.setFilter(L_SELECTED, ['==', ['get', 'key'], p.selected ?? '']);

    // Pins follow the brand accent; re-tint on theme / colour change.
    if (map.getLayer(L_POINTS)) map.setPaintProperty(L_POINTS, 'circle-color', p.palette.accent);

    if (this.hovered && !byKey.has(this.hovered) && !p.bubbles.some((b) => b.key === this.hovered)) this.clearHover();
  }

  private frame(level: MapLevel): void {
    const map = this.map;
    if (!map || this.flownLevel === level) return;
    this.flownLevel = level;
    this.clearHover();
    map.fitBounds(VIEW_BOUNDS[level], {
      padding: 24,
      duration: this.reducedMotion ? 0 : FLY_MS,
      essential: false,
      linear: false,
      curve: 1.6,
    });
  }

  // ─────────── interaction ───────────

  private keyOf(e: MapLayerMouseEvent): string | null {
    const key = e.features?.[0]?.properties?.['key'];
    return typeof key === 'string' && key ? key : null;
  }

  private onHover(e: MapLayerMouseEvent): void {
    const map = this.map;
    const key = this.keyOf(e);
    if (!map || !key) return;
    const source = e.features?.[0]?.source ?? SRC_REGIONS;
    if (this.hovered !== key) {
      this.clearHover();
      this.hovered = key;
      this.hoveredId = key;
      map.setFeatureState({ source, id: key }, { hover: true });
      this.hoveredSource = source;
    }
    map.getCanvas().style.cursor = 'pointer';
    const html = this.tooltip()(key);
    if (html && this.popup) this.popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
  }

  private hoveredSource = SRC_REGIONS;
  /** Feature id passed to `setFeatureState` (a region key, or a numeric pin id). */
  private hoveredId: string | number | null = null;

  private clearHover(): void {
    const map = this.map;
    if (!map) return;
    if (this.hoveredId != null && map.getSource(this.hoveredSource)) {
      map.setFeatureState({ source: this.hoveredSource, id: this.hoveredId }, { hover: false });
    }
    this.hovered = null;
    this.hoveredId = null;
    map.getCanvas().style.cursor = '';
    this.popup?.remove();
  }

  /** A pin's own popup (label / sub escaped here) + a slightly bigger dot. */
  private onPinHover(e: MapLayerMouseEvent): void {
    const map = this.map;
    const feat = e.features?.[0];
    if (!map || !feat) return;
    map.getCanvas().style.cursor = 'pointer';
    const props = feat.properties ?? {};
    const id = props['id'];
    if (this.hovered !== `pt:${id}`) {
      this.clearHover();
      this.hovered = `pt:${id}`;
      this.hoveredSource = SRC_POINTS;
      if (typeof id === 'number') {
        this.hoveredId = id;
        map.setFeatureState({ source: SRC_POINTS, id }, { hover: true });
      }
    }
    const label = escapeHtml(String(props['label'] ?? ''));
    const sub = props['sub'] ? `<div class="gm-pin__sub">${escapeHtml(String(props['sub']))}</div>` : '';
    if (this.popup) {
      this.popup.setLngLat(e.lngLat).setHTML(`<div class="gm-pin"><div class="gm-pin__name">${label}</div>${sub}</div>`).addTo(map);
    }
  }

  /** Expanding rings on the hotspot bubbles (~30 fps, paused in hidden tabs by rAF). */
  private startPulse(): void {
    cancelAnimationFrame(this.pulseFrame);
    if (this.reducedMotion) return;
    let last = 0;
    const tick = (t: number) => {
      this.pulseFrame = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const map = this.map;
      if (!map?.getLayer(L_PULSE)) return;
      const phase = (t % 2200) / 2200;
      map.setPaintProperty(L_PULSE, 'circle-radius', ['*', ['get', 'radius'], 1 + phase * 1.6]);
      map.setPaintProperty(L_PULSE, 'circle-stroke-opacity', 0.7 * (1 - phase));
      map.setPaintProperty(L_PULSE, 'circle-opacity', 0.18 * (1 - phase));
    };
    this.pulseFrame = requestAnimationFrame(tick);
  }
}
