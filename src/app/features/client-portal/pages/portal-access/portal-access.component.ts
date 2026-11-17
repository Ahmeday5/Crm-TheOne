import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PortalBrandingService } from '../../services/portal-branding.service';

type AccessReason =
  | 'link_invalid'
  | 'link_revoked'
  | 'link_expired'
  | 'customer_inactive'
  | 'rate_limited'
  | 'network'
  | 'no_link'
  | 'signed_out';

const KNOWN: ReadonlyArray<AccessReason> = [
  'link_invalid', 'link_revoked', 'link_expired', 'customer_inactive', 'rate_limited', 'network', 'no_link', 'signed_out',
];

const ICONS: Record<AccessReason, string> = {
  link_invalid: 'fa-solid fa-link-slash',
  link_revoked: 'fa-solid fa-ban',
  link_expired: 'fa-solid fa-hourglass-end',
  customer_inactive: 'fa-solid fa-user-lock',
  rate_limited: 'fa-solid fa-gauge-high',
  network: 'fa-solid fa-wifi',
  no_link: 'fa-solid fa-envelope-open-text',
  signed_out: 'fa-solid fa-door-open',
};

/**
 * `/portal/access?reason=` — why the portal can't open, in plain words, with
 * TheOne's contact buttons. Never a dead end: every state says what to do
 * next (ask for a new link, wait N seconds, retry).
 */
@Component({
  selector: 'app-portal-access',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-access.component.html',
  styleUrl: './portal-access.component.scss',
})
export class PortalAccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly brand = inject(PortalBrandingService);

  protected readonly reason = toSignal(
    this.route.queryParamMap.pipe(
      map((q) => {
        const r = q.get('reason') as AccessReason | null;
        return r && KNOWN.includes(r) ? r : 'no_link';
      }),
    ),
    { initialValue: 'no_link' as AccessReason },
  );
  protected readonly icon = computed(() => ICONS[this.reason()]);
  protected readonly tone = computed(() =>
    this.reason() === 'signed_out' || this.reason() === 'no_link' ? 'brand' : this.reason() === 'rate_limited' || this.reason() === 'network' ? 'warning' : 'danger',
  );
  protected readonly canRetry = computed(() => this.reason() === 'rate_limited' || this.reason() === 'network');

  protected readonly waitSec = signal(Number(this.route.snapshot.queryParamMap.get('retryAfter')) || 0);
  protected readonly waitLabel = computed(() => {
    const s = this.waitSec();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    this.brand.load();
    const timer = setInterval(() => this.waitSec.update((s) => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected retry(): void {
    // Back to the previous page (the link page re-runs the exchange).
    if (history.length > 1) history.back();
    else this.router.navigate(['/portal']);
  }
}
