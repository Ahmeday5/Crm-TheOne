import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import { PointerParallaxDirective } from '../../../../shared/directives/pointer-parallax.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { prefersReducedMotion } from '../../../../shared/utils/motion.util';
import {
  SHOWCASE_FEATURES,
  SHOWCASE_FEED,
  SHOWCASE_PARTICLES,
  SHOWCASE_REVENUE,
  SHOWCASE_STATS,
  SHOWCASE_WORDS,
  ShowcaseFeedItem,
  sparklinePath,
} from './auth-showcase.data';

const WORD_INTERVAL_MS = 2600;
const FEED_INTERVAL_MS = 2800;
/** Rows kept in the DOM; the last one sits under the fade mask. */
const FEED_VISIBLE = 4;

/**
 * Animated brand panel shown beside the login form on desktop: drifting
 * brand shapes, a rotating headline, floating "live" dashboard widgets with
 * pointer parallax, counters and a feature marquee.
 *
 * Purely presentational — all copy lives in `auth-showcase.data.ts`, all
 * motion is CSS except two small timers (headline word + activity feed),
 * which are skipped entirely for reduced-motion users.
 */
@Component({
  selector: 'app-auth-showcase',
  standalone: true,
  imports: [TranslatePipe, CountUpDirective, PointerParallaxDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-showcase.component.html',
  styleUrl: './auth-showcase.component.scss',
})
export class AuthShowcaseComponent implements OnInit {
  readonly logo = input<string | null>(null);
  readonly fallbackLogo = input.required<string>();
  readonly brandName = input<string | null>(null);

  readonly stats = SHOWCASE_STATS;
  /** Doubled so the marquee can loop seamlessly at -50%. */
  readonly marquee = [...SHOWCASE_FEATURES, ...SHOWCASE_FEATURES];
  readonly particles = SHOWCASE_PARTICLES;
  readonly revenue = SHOWCASE_REVENUE;
  readonly sparkline = sparklinePath(SHOWCASE_REVENUE);

  readonly word = signal<string>(SHOWCASE_WORDS[0]);
  readonly feed = signal<ShowcaseFeedItem[]>(
    SHOWCASE_FEED.slice(0, FEED_VISIBLE - 1).map((t, i) => ({ ...t, id: i })),
  );

  private readonly destroyRef = inject(DestroyRef);
  private wordIndex = 0;
  private feedCursor = FEED_VISIBLE - 1;

  ngOnInit(): void {
    if (prefersReducedMotion()) return;

    const timers = [
      setInterval(() => this.nextWord(), WORD_INTERVAL_MS),
      setInterval(() => this.pushFeedItem(), FEED_INTERVAL_MS),
    ];
    this.destroyRef.onDestroy(() => timers.forEach(clearInterval));
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = this.fallbackLogo();
    if (!img.src.endsWith(fallback)) img.src = fallback;
  }

  private nextWord(): void {
    this.wordIndex = (this.wordIndex + 1) % SHOWCASE_WORDS.length;
    this.word.set(SHOWCASE_WORDS[this.wordIndex]);
  }

  private pushFeedItem(): void {
    const template = SHOWCASE_FEED[this.feedCursor % SHOWCASE_FEED.length];
    const item: ShowcaseFeedItem = { ...template, id: this.feedCursor++ };
    this.feed.update((rows) => [item, ...rows].slice(0, FEED_VISIBLE));
  }
}
