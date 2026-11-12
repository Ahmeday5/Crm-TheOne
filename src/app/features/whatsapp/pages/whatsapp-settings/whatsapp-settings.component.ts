import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AssignOutcome,
  WaAssignNumberDialogComponent,
} from '../../components/wa-assign-number-dialog/wa-assign-number-dialog.component';
import { WaChannelBadgeComponent } from '../../components/wa-channel-badge/wa-channel-badge.component';
import { WaDiagnosticsComponent } from '../../components/wa-diagnostics/wa-diagnostics.component';
import { WaImportResult, WaInstance } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppAssignmentService } from '../../services/whatsapp-assignment.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  InstanceStatusMeta,
  WHATSAPP_IMPORT_MAX,
  channelLabel,
  instanceStatusMeta,
  isChannelActive,
  whatsappErrorText,
} from '../../utils/whatsapp.util';

type SettingsTab = 'channels' | 'diagnostics';

/**
 * `/whatsapp/settings` (Admin) — channels, history import and diagnostics.
 *
 * - Channels: every WhatsApp number and Messenger page with its live status
 *   (disconnected ones say "re-link it in the Mihwar dashboard"), assignee
 *   and counters. The admin assigns / unassigns employees here; channels are
 *   connected in the Mihwar dashboard, never in the CRM.
 * - Import: pulls past conversations from Mihwar (`POST /import`, ~1 min,
 *   idempotent) and shows what was added.
 * - Diagnostics (`?tab=diagnostics`): configuration, provider channels,
 *   webhook queue health.
 *
 * The table reads the session store's channels, so hub status events
 * update it live.
 */
@Component({
  selector: 'app-whatsapp-settings',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
    PageHeaderComponent,
    UserAvatarComponent,
    ResponsiveTableDirective,
    ClampTextDirective,
    WaAssignNumberDialogComponent,
    WaChannelBadgeComponent,
    WaDiagnosticsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-settings.component.html',
  styleUrl: './whatsapp-settings.component.scss',
})
export class WhatsAppSettingsComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly assignment = inject(WhatsAppAssignmentService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly session = inject(WhatsAppSessionStore);

  protected readonly tab = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((q): SettingsTab => (q.get('tab') === 'diagnostics' ? 'diagnostics' : 'channels')),
    ),
    { initialValue: 'channels' as SettingsTab },
  );

  /** The channel whose assign / change dialog is open. */
  protected readonly assigning = signal<WaInstance | null>(null);
  /** Channel id with an unassign in flight. */
  protected readonly unlinkingId = signal<string | null>(null);

  protected readonly importing = signal(false);
  protected readonly importResult = signal<WaImportResult | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importMax = WHATSAPP_IMPORT_MAX;

  protected readonly loading = computed(() => this.session.channelsLoading());
  protected readonly loadError = computed(() =>
    this.session.channels().length ? null : this.session.channelsError(),
  );

  /** Present first, WhatsApp before Messenger, company number first, then by name. */
  protected readonly rows = computed(() =>
    [...this.session.channels()].sort(
      (a, b) =>
        Number(isChannelActive(b)) - Number(isChannelActive(a)) ||
        Number(b.type === 'whatsapp_cloud') - Number(a.type === 'whatsapp_cloud') ||
        Number(b.isDefault) - Number(a.isDefault) ||
        channelLabel(a).localeCompare(channelLabel(b)),
    ),
  );

  protected readonly kpis = computed(() => {
    const list = this.session.channels().filter(isChannelActive);
    const connected = list.filter((i) => i.canSend).length;
    return {
      total: list.length,
      connected,
      attention: list.length - connected,
      assigned: list.filter((i) => !!i.assignedUserId).length,
    };
  });

  /** Import errors as readable lines (the backend may send strings or rows). */
  protected readonly importErrors = computed(() =>
    (this.importResult()?.errors ?? []).map((e) => (typeof e === 'string' ? e : JSON.stringify(e))),
  );

  ngOnInit(): void {
    // Fresh from the provider every time the page opens.
    this.load();
  }

  protected load(): void {
    this.session.loadChannels();
  }

  protected setTab(tab: SettingsTab): void {
    this.router.navigate([], { queryParams: { tab: tab === 'channels' ? null : tab }, replaceUrl: true });
  }

  // ─────────────── assignment ───────────────

  protected openAssign(instance: WaInstance): void {
    this.assigning.set(instance);
  }

  protected onAssigned(outcome: AssignOutcome): void {
    this.assigning.set(null);
    this.toast.success(this.t(outcome === 'changed' ? 'whatsapp.numbers.toasts.changed' : 'whatsapp.numbers.toasts.linked'));
    this.load();
  }

  protected async confirmUnlink(instance: WaInstance): Promise<void> {
    if (!instance.assignedUserId || this.unlinkingId()) return;

    const ok = await this.dialog.confirm({
      title: this.t('whatsapp.numbers.unlinkDialog.title'),
      message: interpolate(this.t('whatsapp.numbers.unlinkDialog.message'), {
        name: instance.assignedUserName || '—',
        channel: this.label(instance),
      }),
      confirmText: this.t('whatsapp.numbers.unlinkDialog.confirm'),
      cancelText: this.t('whatsapp.numbers.unlinkDialog.cancel'),
      type: 'warning',
    });
    if (!ok) return;

    this.unlinkingId.set(instance.id);
    this.assignment
      .unassign(instance, this.session.channels())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unlinkingId.set(null);
          this.session.applyInstance({ ...instance, assignedUserId: null, assignedUserName: null });
          this.toast.success(this.t('whatsapp.numbers.toasts.unlinked'));
          this.load();
        },
        error: (err: unknown) => {
          this.unlinkingId.set(null);
          this.toast.error(whatsappErrorText(err, (k) => this.t(k)));
          this.load();
        },
      });
  }

  // ─────────────── import ───────────────

  /** Long request (~1 min): button disabled + spinner, no client timeout. */
  protected runImport(): void {
    if (this.importing()) return;
    this.importing.set(true);
    this.importError.set(null);
    this.importResult.set(null);
    this.api
      .importHistory(this.importMax)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.importResult.set(normalizeImport(result));
          this.toast.success(this.t('whatsapp.import.done'));
          this.load();
        },
        error: (err: unknown) => {
          this.importing.set(false);
          this.importError.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.import.failed'));
        },
      });
  }

  // ─────────────── view helpers ───────────────

  protected label(instance: WaInstance): string {
    return channelLabel(instance);
  }

  protected status(instance: WaInstance): InstanceStatusMeta {
    if (!isChannelActive(instance)) return { tone: 'gray', labelKey: 'whatsapp.channels.removed' };
    return instanceStatusMeta(instance.canSend ? 'CONNECTED' : instance.status);
  }

  protected active(instance: WaInstance): boolean {
    return isChannelActive(instance);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}

/** Missing counters render as 0, never "undefined". */
function normalizeImport(result: Partial<WaImportResult> | null | undefined): WaImportResult {
  const errors = result?.errors;
  return {
    conversations: result?.conversations ?? 0,
    newChats: result?.newChats ?? 0,
    newMessages: result?.newMessages ?? 0,
    skipped: result?.skipped ?? 0,
    errors: Array.isArray(errors) ? errors : [],
  };
}
