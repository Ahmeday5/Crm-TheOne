import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, exhaustMap, filter, interval, map, of } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { parseUtc } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaInstance, WaPairingCode } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppRealtimeService } from '../../services/whatsapp-realtime.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  WHATSAPP_PAIRING_POLL_MS,
  formatWhatsAppPhone,
  normalizeInternationalPhone,
  retryAfterSeconds,
  whatsappErrorText,
} from '../../utils/whatsapp.util';

type Step = 'phone' | 'code' | 'expired';

const DEFAULT_PREFIX = '+20';

/**
 * "Connect your WhatsApp" — links a phone with a pairing code (the provider
 * exposes no QR over the API).
 *
 *   1. The employee types their WhatsApp number (international format).
 *   2. `POST /instances/connect` → the code is shown big, with a countdown.
 *   3. They enter it on the phone (Linked devices → Link with phone number).
 *   4. While open, `GET /status` (or the channel, for an admin) is polled
 *      every 5 s and the hub's instance events are watched; once the number
 *      can send, the dialog reports success and closes.
 *
 * Admins open it for a channel (`instance` set) and the request carries its id.
 * The code lives only in this component's memory — never stored or logged.
 */
@Component({
  selector: 'app-wa-connect-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-connect-dialog.component.html',
  styleUrl: './wa-connect-dialog.component.scss',
})
export class WaConnectDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly realtime = inject(WhatsAppRealtimeService);
  private readonly session = inject(WhatsAppSessionStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Admin: the channel to link. Omit for the caller's own number. */
  readonly instance = input<WaInstance | null>(null);

  readonly closed = output<void>();
  /** The number is connected and can send. */
  readonly connected = output<void>();

  protected readonly step = signal<Step>('phone');
  protected readonly phone = signal(DEFAULT_PREFIX);
  protected readonly touched = signal(false);
  protected readonly requesting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pairing = signal<WaPairingCode | null>(null);
  protected readonly copied = signal(false);
  /** Ticks every second for the countdowns. */
  private readonly now = signal(Date.now());
  /** "Try again in N seconds" from the backend → the earliest next request. */
  private readonly cooldownUntil = signal(0);

  protected readonly normalizedPhone = computed(() => normalizeInternationalPhone(this.phone()));
  protected readonly phoneInvalid = computed(() => this.touched() && !this.normalizedPhone());
  protected readonly channelPhone = computed(() => formatWhatsAppPhone(this.instance()?.phoneNumber));

  /** `1 2 3 4 - 5 6 7 8` style grouping for legibility. */
  protected readonly codeChunks = computed(() => {
    const code = (this.pairing()?.pairingCode ?? '').replace(/[\s-]+/g, '');
    return code.length === 8 ? [code.slice(0, 4), code.slice(4)] : [code];
  });

  protected readonly secondsLeft = computed(() => {
    const expiresAt = parseUtc(this.pairing()?.expiresAt)?.getTime() ?? 0;
    return Math.max(0, Math.ceil((expiresAt - this.now()) / 1000));
  });
  protected readonly countdown = computed(() => formatClock(this.secondsLeft()));
  protected readonly cooldown = computed(() => Math.max(0, Math.ceil((this.cooldownUntil() - this.now()) / 1000)));
  protected readonly canRequest = computed(() => !this.requesting() && this.cooldown() === 0);

  private done = false;

  ngOnInit(): void {
    const known = normalizeInternationalPhone(this.instance()?.phoneNumber ?? this.session.status()?.phoneNumber);
    if (known) this.phone.set(known);

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.now.set(Date.now());
        if (this.step() === 'code' && this.secondsLeft() === 0) this.expire();
      });

    // Poll while open — the hub event below is usually faster.
    interval(WHATSAPP_PAIRING_POLL_MS)
      .pipe(
        filter(() => this.step() !== 'phone'),
        exhaustMap(() => this.isConnected()),
        filter(Boolean),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.succeed());

    this.realtime.instanceStatus$
      .pipe(
        filter(({ instance }) => instance.id === this.targetInstanceId()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ instance, becameConnected }) => {
        if (becameConnected || instance.canSend) this.succeed();
      });

    this.destroyRef.onDestroy(() => this.pairing.set(null));
  }

  // ─────────────── template handlers ───────────────

  protected onPhoneInput(value: string): void {
    this.phone.set(value);
    this.error.set(null);
  }

  protected requestCode(): void {
    this.touched.set(true);
    const phone = this.normalizedPhone();
    if (!phone || !this.canRequest()) return;

    this.requesting.set(true);
    this.error.set(null);
    const instanceId = this.instance()?.id;

    this.api
      .connect(instanceId ? { phone, instanceId } : { phone })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (code) => {
          this.requesting.set(false);
          this.copied.set(false);
          this.pairing.set(code);
          this.now.set(Date.now());
          this.step.set('code');
        },
        error: (err) => {
          this.requesting.set(false);
          const wait = retryAfterSeconds(err);
          // "Already requested — try again in N s": a countdown, not an error.
          if (wait) this.cooldownUntil.set(Date.now() + wait * 1000);
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.connect.requestFailed'));
        },
      });
  }

  protected async copyCode(): Promise<void> {
    const code = this.pairing()?.pairingCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.toast.error(this.t('whatsapp.connect.copyFailed'));
    }
  }

  protected changeNumber(): void {
    this.pairing.set(null);
    this.error.set(null);
    this.step.set('phone');
  }

  protected close(): void {
    this.pairing.set(null);
    this.closed.emit();
  }

  // ─────────────── internals ───────────────

  private targetInstanceId(): string | null {
    return this.instance()?.id ?? this.pairing()?.instanceId ?? this.session.status()?.instanceId ?? null;
  }

  /** Own number → `GET /status`; an admin's channel → `GET /instances/{id}`. */
  private isConnected(): Observable<boolean> {
    const channel = this.instance();
    if (channel) {
      return this.api.instance(channel.id).pipe(
        map((live) => {
          this.session.applyInstance(live);
          return live.canSend;
        }),
        catchError(() => of(false)),
      );
    }
    return this.api.status().pipe(
      map((status) => status.canSend),
      catchError(() => of(false)),
    );
  }

  private expire(): void {
    this.pairing.set(null);
    this.step.set('expired');
  }

  private succeed(): void {
    if (this.done) return;
    this.done = true;
    this.pairing.set(null);
    this.session.loadStatus();
    this.session.loadChannels();
    this.toast.success(this.t('whatsapp.connect.success'));
    this.connected.emit();
    this.closed.emit();
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
