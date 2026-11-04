/**
 * Static content for the login showcase panel. Kept out of the component so
 * the component only deals with timing / state, and copy changes stay here.
 * All labels are i18n keys under `auth.showcase.*` / `auth.stats.*`.
 */

/** Maps onto the app's status tokens (--success, --info, …). */
export type ShowcaseTone = 'success' | 'info' | 'brand' | 'warning';

export interface ShowcaseFeedTemplate {
  key: string;
  icon: string;
  tone: ShowcaseTone;
}

export interface ShowcaseFeedItem extends ShowcaseFeedTemplate {
  /** Monotonic id — doubles as the `@for` track key so new rows animate in. */
  id: number;
}

export interface ShowcaseStat {
  value: number;
  suffix: string;
  labelKey: string;
}

export interface ShowcaseFeature {
  labelKey: string;
  icon: string;
}

export interface ShowcaseParticle {
  x: number;
  size: number;
  duration: number;
  delay: number;
}

/** Words cycled after the headline ("One workspace to run your ___"). */
export const SHOWCASE_WORDS = ['sales', 'marketing', 'support', 'projects', 'growth'] as const;

export const SHOWCASE_FEED: readonly ShowcaseFeedTemplate[] = [
  { key: 'auth.showcase.feed.deal', icon: 'fa-solid fa-handshake', tone: 'success' },
  { key: 'auth.showcase.feed.ticket', icon: 'fa-solid fa-headset', tone: 'info' },
  { key: 'auth.showcase.feed.campaign', icon: 'fa-solid fa-bullhorn', tone: 'brand' },
  { key: 'auth.showcase.feed.meeting', icon: 'fa-solid fa-calendar-check', tone: 'warning' },
  { key: 'auth.showcase.feed.message', icon: 'fa-solid fa-comments', tone: 'success' },
  { key: 'auth.showcase.feed.goal', icon: 'fa-solid fa-trophy', tone: 'warning' },
];

export const SHOWCASE_STATS: readonly ShowcaseStat[] = [
  { value: 10, suffix: '+', labelKey: 'auth.stats.modules' },
  { value: 5, suffix: '', labelKey: 'auth.stats.roles' },
  { value: 99, suffix: '%', labelKey: 'auth.stats.uptime' },
  { value: 24, suffix: '/7', labelKey: 'auth.stats.support' },
];

export const SHOWCASE_FEATURES: readonly ShowcaseFeature[] = [
  { labelKey: 'auth.showcase.features.sales', icon: 'fa-solid fa-chart-line' },
  { labelKey: 'auth.showcase.features.campaigns', icon: 'fa-solid fa-bullhorn' },
  { labelKey: 'auth.showcase.features.tickets', icon: 'fa-solid fa-ticket' },
  { labelKey: 'auth.showcase.features.whatsapp', icon: 'fa-solid fa-comments' },
  { labelKey: 'auth.showcase.features.goals', icon: 'fa-solid fa-trophy' },
  { labelKey: 'auth.showcase.features.contracts', icon: 'fa-solid fa-file-signature' },
  { labelKey: 'auth.showcase.features.reports', icon: 'fa-solid fa-chart-pie' },
  { labelKey: 'auth.showcase.features.projects', icon: 'fa-solid fa-diagram-project' },
];

/** Revenue widget bar heights, in % of the chart height. */
export const SHOWCASE_REVENUE = [34, 48, 42, 58, 52, 66, 61, 74, 69, 82, 78, 94];

/**
 * Deterministic "random" particles — computed once so the template never
 * changes between change-detection passes.
 */
export const SHOWCASE_PARTICLES: readonly ShowcaseParticle[] = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  size: 2 + ((i * 7) % 4),
  duration: 10 + ((i * 5) % 11),
  delay: -((i * 1.7) % 14),
}));

/** Builds an SVG polyline path through the bar tops (viewBox 0 0 100 100). */
export function sparklinePath(values: readonly number[]): string {
  const step = 100 / (values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)} ${(100 - v).toFixed(2)}`)
    .join(' ');
}
