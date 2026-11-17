import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, timer } from 'rxjs';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PortalLinkError, StoredPortalSession, isPinProblem } from '../../models/portal-session.models';
import { PortalBrandingService } from '../../services/portal-branding.service';
import { PortalSessionService, toLinkError } from '../../services/portal-session.service';

type Step = 'opening' | 'pin' | 'name' | 'leaving';

const INTRO_KEY = 'crm_one_portal_intro_seen';
const NAME_ASKED_KEY = 'crm_one_portal_name_asked';
/** The intro plays at least this long the first time (it is part of the welcome). */
const INTRO_MIN_MS = 1400;

/**
 * `/p/:token` — the client's private link. Plays the branded intro while the
 * link is exchanged for a session, asks for the PIN when the link has one,
 * optionally asks the visitor's name (once), then opens the portal. The token
 * leaves the address bar on the way in (`replaceUrl`).
 */
@Component({
  selector: 'app-portal-entry',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-entry.component.html',
  styleUrl: './portal-entry.component.scss',
})
export class PortalEntryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(PortalSessionService);
  protected readonly brand = inject(PortalBrandingService);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly step = signal<Step>('opening');
  protected readonly pin = signal('');
  protected readonly pinError = signal<'pin_invalid' | 'pin_locked' | null>(null);
  protected readonly lockedFor = signal(0);
  protected readonly busy = signal(false);
  protected readonly visitorName = signal('');
  protected readonly customerName = computed(() => this.session.customer()?.companyName || this.session.customer()?.name || '');
  protected readonly pinValid = computed(() => /^\d{4,6}$/.test(this.pin()));

  private countdown: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.brand.load();
    inject(DestroyRef).onDestroy(() => this.countdown && clearInterval(this.countdown));
    if (!this.token) {
      this.leaveTo('no_link');
      return;
    }
    this.exchange(null, firstVisit() ? INTRO_MIN_MS : 500);
  }

  protected submitPin(): void {
    if (!this.pinValid() || this.busy() || this.lockedFor() > 0) return;
    this.exchange(this.pin(), 0);
  }

  protected onPinInput(value: string): void {
    this.pin.set(value.replace(/\D/g, '').slice(0, 6));
    this.pinError.set(null);
  }

  protected saveName(): void {
    const name = this.visitorName().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    rememberNameAsked(this.session.customer()?.id);
    this.session.rename(name).subscribe({
      next: () => this.enter(),
      error: () => this.enter(),
    });
  }

  protected skipName(): void {
    rememberNameAsked(this.session.customer()?.id);
    this.enter();
  }

  private exchange(pin: string | null, minMs: number): void {
    this.busy.set(true);
    const open$: Observable<[StoredPortalSession, number]> = forkJoin([this.session.open(this.token, { pin }), timer(minMs)]);
    open$.subscribe({
      next: ([s]) => {
        this.busy.set(false);
        markIntroSeen();
        if (!s.visitorName && !nameAsked(s.customer.id)) {
          this.step.set('name');
          return;
        }
        this.enter();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const err = e instanceof PortalLinkError ? e : toLinkError(e);
        if (isPinProblem(err.problem)) {
          const firstAsk = this.step() !== 'pin';
          this.step.set('pin');
          if (err.problem === 'pin_locked') this.startLock(err.retryAfterSec ?? 60);
          else if (!firstAsk || pin) this.pinError.set('pin_invalid');
          if (err.problem === 'pin_invalid') this.pin.set('');
          return;
        }
        this.leaveTo(err.problem, err.retryAfterSec);
      },
    });
  }

  private enter(): void {
    this.step.set('leaving');
    // Let the exit fade play, then swap routes (token leaves the history).
    setTimeout(() => this.router.navigate(['/portal'], { replaceUrl: true }), 280);
  }

  private leaveTo(reason: string, retryAfter: number | null = null): void {
    // Temporary problems keep this page in history so "retry" (back) re-runs the exchange.
    const temporary = reason === 'network' || reason === 'rate_limited';
    this.router.navigate(['/portal/access'], {
      queryParams: { reason, retryAfter: retryAfter ?? undefined },
      replaceUrl: !temporary,
    });
  }

  private startLock(seconds: number): void {
    this.pinError.set('pin_locked');
    this.lockedFor.set(seconds);
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = setInterval(() => {
      const left = this.lockedFor() - 1;
      this.lockedFor.set(Math.max(0, left));
      if (left <= 0 && this.countdown) {
        clearInterval(this.countdown);
        this.countdown = null;
        this.pinError.set(null);
      }
    }, 1000);
  }
}

function firstVisit(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return true;
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* ignore */
  }
}

function nameAsked(customerId: number): boolean {
  try {
    return localStorage.getItem(`${NAME_ASKED_KEY}_${customerId}`) === '1';
  } catch {
    return true;
  }
}

function rememberNameAsked(customerId: number | undefined): void {
  if (customerId == null) return;
  try {
    localStorage.setItem(`${NAME_ASKED_KEY}_${customerId}`, '1');
  } catch {
    /* ignore */
  }
}
