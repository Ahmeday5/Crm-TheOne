import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaDiagnostics, WaInstanceStatus, WaWebhookEvent } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { formatWhatsAppPhone, instanceStatusMeta, whatsappErrorText } from '../../utils/whatsapp.util';

interface DiagnosticAlert {
  key: string;
  /** Server-provided detail (e.g. the Wavex error), shown as is. */
  detail?: string;
}

/**
 * Admin → WhatsApp numbers → Diagnostics (`GET /diagnostics`): is the
 * integration wired correctly end to end?
 *
 * - red alerts for a missing API key / webhook secret or a provider error;
 * - local numbers vs. the configured Wavex account ("Not in current Wavex
 *   account" usually means the API key points at another account);
 * - webhook queue health: pending / failed counters + the latest events.
 */
@Component({
  selector: 'app-wa-diagnostics',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, LoadErrorComponent, ResponsiveTableDirective, ClampTextDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-diagnostics.component.html',
  styleUrl: './wa-diagnostics.component.scss',
})
export class WaDiagnosticsComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<WaDiagnostics | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly alerts = computed<DiagnosticAlert[]>(() => {
    const d = this.data();
    if (!d) return [];
    const list: DiagnosticAlert[] = [];
    if (!d.apiKeyConfigured) list.push({ key: 'whatsapp.diagnostics.alerts.apiKey' });
    if (!d.webhookSecretConfigured) list.push({ key: 'whatsapp.diagnostics.alerts.webhookSecret' });
    if (d.wavexError) list.push({ key: 'whatsapp.diagnostics.alerts.wavex', detail: d.wavexError });
    return list;
  });

  /** Numbers on the Wavex account that the CRM doesn't know yet (press Refresh on the numbers tab). */
  protected readonly accountOnly = computed(() => {
    const d = this.data();
    if (!d) return [];
    const local = new Set(d.localInstances.map((i) => i.instanceId));
    return d.wavexAccountInstances.filter((i) => !local.has(i.id));
  });

  protected readonly missingFromAccount = computed(
    () => this.data()?.localInstances.filter((i) => !i.inCurrentWavexAccount).length ?? 0,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .diagnostics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.loading.set(false);
          this.data.set(d);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.diagnostics.loadFailed'));
        },
      });
  }

  protected phone(value: string | null): string {
    return formatWhatsAppPhone(value) || '—';
  }

  protected statusTone(status: string | null): string {
    // The provider's raw status string — unknown values fall back to grey.
    return instanceStatusMeta(status as WaInstanceStatus | null).tone;
  }

  protected eventNumber(e: WaWebhookEvent): string {
    const phone = formatWhatsAppPhone(e.instancePhoneNumber);
    return [phone, e.instanceOwnerName].filter(Boolean).join(' · ') || e.instanceId || '—';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
