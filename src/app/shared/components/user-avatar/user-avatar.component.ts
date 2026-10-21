import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { resolveAssetUrl } from '../../../core/utils/asset-url.util';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Muted, theme-safe tints; a name always maps to the same one. */
const TINTS = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777', '#ea580c', '#4f46e5', '#0d9488'];

/**
 * A user's profile picture, falling back to their initial.
 *
 *   <app-user-avatar [name]="user.fullName" [imageUrl]="user.imageUrl" />
 *   <app-user-avatar [name]="entry.fullName" [userId]="entry.userId" size="sm" />
 *
 * - `imageUrl` — server-relative or absolute; wins when provided.
 * - `userId`   — resolves the image through `UserDirectoryService` when the
 *                API row only carries a name + id.
 * A broken image (deleted file, 404) silently degrades to the initial.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Not `.user-avatar`: the header already styles that class for its pill.
    '[class]': '"app-avatar app-avatar--" + size()',
    '[style.--avatar-tint]': 'tint()',
    '[attr.title]': 'name() || null',
    role: 'img',
    '[attr.aria-label]': 'name() || null',
  },
  template: `
    @if (src(); as url) {
      <img [src]="url" alt="" loading="lazy" decoding="async" (error)="failed.set(true)" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  styles: [
    `
      :host {
        --avatar-size: 2.25rem;
        position: relative;
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: var(--avatar-size);
        height: var(--avatar-size);
        border-radius: 50%;
        overflow: hidden;
        background: color-mix(in srgb, var(--avatar-tint) 14%, var(--surface-0));
        color: var(--avatar-tint);
        font-weight: var(--fw-700);
        font-size: calc(var(--avatar-size) * 0.42);
        line-height: 1;
        user-select: none;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--avatar-tint) 22%, transparent);
      }
      :host(.app-avatar--xs) { --avatar-size: 1.5rem; }
      :host(.app-avatar--sm) { --avatar-size: 1.9rem; }
      :host(.app-avatar--lg) { --avatar-size: 3rem; }
      :host(.app-avatar--xl) { --avatar-size: 6.5rem; }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    `,
  ],
})
export class UserAvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly imageUrl = input<string | null | undefined>(undefined);
  readonly userId = input<string | null | undefined>(undefined);
  readonly size = input<UserAvatarSize>('md');

  private readonly directory = inject(UserDirectoryService);

  /** Set when the image fails to load; reset whenever the source changes. */
  protected readonly failed = signal(false);

  private readonly rawSrc = computed(() => {
    const explicit = this.imageUrl();
    if (explicit !== undefined && explicit !== null && explicit !== '') return explicit;
    return this.directory.imageFor(this.userId());
  });

  protected readonly src = computed(() =>
    this.failed() ? null : resolveAssetUrl(this.rawSrc()),
  );

  protected readonly initial = computed(() => {
    const n = (this.name() ?? '').trim();
    return n ? Array.from(n)[0].toLocaleUpperCase() : '?';
  });

  protected readonly tint = computed(() => {
    const n = (this.name() ?? '').trim();
    let hash = 0;
    for (const ch of n) hash = (hash * 31 + ch.codePointAt(0)!) | 0;
    return TINTS[Math.abs(hash) % TINTS.length];
  });

  constructor() {
    effect(
      () => {
        this.rawSrc();
        this.failed.set(false);
      },
      { allowSignalWrites: true },
    );
  }
}
