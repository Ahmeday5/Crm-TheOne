import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  healthBadgeClass,
  healthLabelKey,
  statusBadgeClass,
  statusLabelKey,
} from '../../models/session-badges.util';
import { SessionsStore } from '../../store/sessions.store';

const POLL_INTERVAL_MS = 5000;
const PHONE_PATTERN = /^\d{8,15}$/;

@Component({
  selector: 'app-whatsapp-session-details',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    LoadErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-details.component.html',
  styleUrl: './session-details.component.scss',
})
export class SessionDetailsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(DialogService);
  private readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(SessionsStore);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));

  private qrPoll: Subscription | null = null;

  // ─────────── derived view state ───────────
  readonly session = this.store.selectedSession;
  readonly status = this.store.sessionStatus;
  readonly health = this.store.sessionHealth;
  readonly qr = this.store.qrData;
  readonly connected = this.store.isConnected;

  readonly clientInfo = computed(() => this.status()?.clientInfo ?? null);
  readonly isQrMethod = computed(() => this.session()?.connection_method === 'qr');
  readonly isCodeMethod = computed(() => this.session()?.connection_method === 'code');

  readonly displayPushname = computed(
    () => this.clientInfo()?.pushname || this.session()?.pushname || null,
  );
  readonly displayPhone = computed(
    () => this.clientInfo()?.wid?.user || this.session()?.phone || null,
  );
  readonly platform = computed(() => this.clientInfo()?.platform || null);

  readonly pairForm = this.fb.nonNullable.group({
    phone_number: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
  });

  /** Pairing code split into character tiles. */
  readonly pairChars = computed(() => {
    const code = this.store.pairingCode();
    return code ? code.replace(/[\s-]/g, '').toUpperCase().split('') : [];
  });

  constructor() {
    // Stop QR polling the moment any source reports a live connection.
    effect(() => {
      if (this.connected()) this.stopQrPolling();
    });
  }

  ngOnInit(): void {
    if (!Number.isFinite(this.id)) {
      this.router.navigate(['/whatsapp-sessions']);
      return;
    }
    this.store.resetDetails();
    this.store.loadDetails(this.id);
    this.store.loadHealth(this.id);
    this.startStatusPolling();
  }

  ngOnDestroy(): void {
    this.stopQrPolling();
    this.store.resetDetails();
  }

  // ─────────── polling ───────────

  /** Status + QR both poll on a 5s cadence; status runs until the page dies. */
  private startStatusPolling(): void {
    timer(0, POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.store.loadStatus(this.id);
        // Start QR polling once we know the session uses the QR method and
        // it isn't connected yet.
        if (this.isQrMethod() && !this.connected()) this.ensureQrPolling();
      });
  }

  private ensureQrPolling(): void {
    if (this.qrPoll) return;
    this.qrPoll = timer(0, POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.connected()) {
          this.stopQrPolling();
          return;
        }
        this.store.loadQr(this.id);
      });
  }

  private stopQrPolling(): void {
    this.qrPoll?.unsubscribe();
    this.qrPoll = null;
  }

  // ─────────── pairing ───────────

  submitPair(): void {
    if (this.pairForm.invalid || this.store.pairing()) {
      this.pairForm.markAllAsTouched();
      return;
    }
    this.store.pair(this.id, this.pairForm.getRawValue().phone_number);
  }

  // ─────────── lifecycle actions ───────────

  start(): void {
    this.store.start(this.id);
  }
  stop(): void {
    this.store.stop(this.id);
  }
  restart(): void {
    this.store.restart(this.id);
  }

  async remove(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('whatsapp.deleteDialog.title'),
      message: this.t('whatsapp.deleteDialog.message'),
      confirmText: this.t('whatsapp.deleteDialog.confirm'),
      cancelText: this.t('whatsapp.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;
    this.store.deleteSession(this.id).subscribe({
      next: () => this.router.navigate(['/whatsapp-sessions']),
    });
  }

  back(): void {
    this.router.navigate(['/whatsapp-sessions']);
  }

  openChat(): void {
    this.router.navigate(['/whatsapp-sessions', this.id, 'chat']);
  }

  // ─────────── badge helpers ───────────

  statusLabel(): string {
    return statusLabelKey(this.status()?.status ?? this.session()?.status ?? '');
  }
  statusClass(): string {
    return statusBadgeClass(this.status()?.status ?? this.session()?.status ?? '');
  }
  healthLabel(): string {
    return healthLabelKey(
      this.health()?.health_status ?? this.session()?.health_status ?? '',
    );
  }
  healthClass(): string {
    return healthBadgeClass(
      this.health()?.health_status ?? this.session()?.health_status ?? '',
    );
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      );
    } catch {
      return iso;
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
