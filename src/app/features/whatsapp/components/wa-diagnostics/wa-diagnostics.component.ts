import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChannelType, WaDiagnostics, WaProviderChannel } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { channelLabel, formatWhatsAppPhone, instanceStatusMeta, whatsappErrorText } from '../../utils/whatsapp.util';
import { WaChannelBadgeComponent } from '../wa-channel-badge/wa-channel-badge.component';

interface ConfigCheck {
  labelKey: string;
  hintKey: string;
  ok: boolean;
}

/** A provider channel row, enriched with what the CRM knows about it. */
interface ProviderRow {
  id: string;
  type: WaChannelType | null;
  label: string;
  status: string | null;
  tone: string;
  inCrm: boolean;
}

/**
 * Admin → WhatsApp settings → Diagnostics (`GET /diagnostics`): is the
 * integration wired correctly end to end?
 *
 * - ✅ / ❌ for the API key, the webhook secret and the public base URL;
 * - the provider's error, in red, when Mihwar couldn't be reached;
 * - the channels Mihwar reports (and whether the CRM knows each one);
 * - webhook queue health: pending / failed counters + the latest events.
 */
@Component({
  selector: 'app-wa-diagnostics',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, LoadErrorComponent, ResponsiveTableDirective, ClampTextDirective, WaChannelBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-diagnostics.component.html',
  styleUrl: './wa-diagnostics.component.scss',
})
export class WaDiagnosticsComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly session = inject(WhatsAppSessionStore);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<WaDiagnostics | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly checks = computed<ConfigCheck[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { labelKey: 'whatsapp.diagnostics.checks.apiKey', hintKey: 'whatsapp.diagnostics.checks.apiKeyHint', ok: !!d.apiKeyConfigured },
      {
        labelKey: 'whatsapp.diagnostics.checks.webhookSecret',
        hintKey: 'whatsapp.diagnostics.checks.webhookSecretHint',
        ok: !!d.webhookSecretConfigured,
      },
      {
        labelKey: 'whatsapp.diagnostics.checks.publicBaseUrl',
        hintKey: 'whatsapp.diagnostics.checks.publicBaseUrlHint',
        ok: !!d.publicBaseUrlConfigured,
      },
    ];
  });

  protected readonly allGood = computed(() => {
    const d = this.data();
    return !!d && this.checks().every((c) => c.ok) && !d.providerError;
  });

  protected readonly providerRows = computed<ProviderRow[]>(() => {
    const known = new Set(this.session.channels().map((c) => c.id));
    return (this.data()?.providerChannels ?? []).map((c: WaProviderChannel) => {
      const id = String(c.id);
      return {
        id,
        type: c.type === 'messenger' || c.type === 'whatsapp_cloud' ? c.type : null,
        label: channelLabel({ id, name: c.name ?? null, phoneNumber: c.phoneNumber ?? null }),
        status: c.status ?? null,
        tone: instanceStatusMeta(c.status).tone,
        inCrm: known.has(id),
      };
    });
  });

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
          this.data.set({
            ...d,
            providerChannels: Array.isArray(d?.providerChannels) ? d.providerChannels : [],
            recentWebhookEvents: Array.isArray(d?.recentWebhookEvents) ? d.recentWebhookEvents : [],
          });
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.diagnostics.loadFailed'));
        },
      });
  }

  protected phone(value: string | null): string {
    return formatWhatsAppPhone(value) || '—';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
