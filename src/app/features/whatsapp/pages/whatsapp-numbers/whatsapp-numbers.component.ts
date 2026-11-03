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
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AssignOutcome,
  WaAssignNumberDialogComponent,
} from '../../components/wa-assign-number-dialog/wa-assign-number-dialog.component';
import { WaConnectDialogComponent } from '../../components/wa-connect-dialog/wa-connect-dialog.component';
import { WaDiagnosticsComponent } from '../../components/wa-diagnostics/wa-diagnostics.component';
import { WaInstance } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  InstanceStatusMeta,
  canPair,
  formatWhatsAppPhone,
  instanceStatusMeta,
  isChannelActive,
  whatsappErrorText,
} from '../../utils/whatsapp.util';

type NumbersTab = 'numbers' | 'diagnostics';

/**
 * `/whatsapp/numbers` (Admin) — every company number with its live status,
 * assignee and counters. The admin assigns numbers to employees (one each)
 * and can request a pairing code for any number that isn't connected; the
 * employee can also link it themselves from the inbox.
 *
 * The list is the session store's channels, so hub status events update the
 * table live; "Refresh" re-syncs with the provider. A second tab
 * (`?tab=diagnostics`) shows the integration's health.
 */
@Component({
  selector: 'app-whatsapp-numbers',
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
    WaAssignNumberDialogComponent,
    WaConnectDialogComponent,
    WaDiagnosticsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-numbers.component.html',
  styleUrl: './whatsapp-numbers.component.scss',
})
export class WhatsAppNumbersComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(WhatsAppSessionStore);
  private readonly router = inject(Router);

  protected readonly tab = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((q): NumbersTab => (q.get('tab') === 'diagnostics' ? 'diagnostics' : 'numbers')),
    ),
    { initialValue: 'numbers' as NumbersTab },
  );

  /** The number whose assign / change dialog is open. */
  protected readonly assigning = signal<WaInstance | null>(null);
  /** The number whose pairing dialog is open. */
  protected readonly pairing = signal<WaInstance | null>(null);
  /** Instance id with an unassign in flight. */
  protected readonly unlinkingId = signal<string | null>(null);

  protected readonly loading = computed(() => this.session.channelsLoading());
  protected readonly loadError = computed(() =>
    this.session.channels().length ? null : this.session.channelsError(),
  );

  /** Company number first, then present numbers by phone, removed ones last. */
  protected readonly rows = computed(() =>
    [...this.session.channels()].sort(
      (a, b) =>
        Number(isChannelActive(b)) - Number(isChannelActive(a)) ||
        Number(b.isDefault) - Number(a.isDefault) ||
        (a.phoneNumber ?? '').localeCompare(b.phoneNumber ?? ''),
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

  ngOnInit(): void {
    // Fresh from the provider every time the page opens.
    this.load();
  }

  protected load(): void {
    this.session.loadChannels();
  }

  protected setTab(tab: NumbersTab): void {
    this.router.navigate([], { queryParams: { tab: tab === 'numbers' ? null : tab }, replaceUrl: true });
  }

  protected openAssign(instance: WaInstance): void {
    this.assigning.set(instance);
  }

  protected onAssigned(outcome: AssignOutcome): void {
    this.assigning.set(null);
    this.toast.success(this.t(outcome === 'changed' ? 'whatsapp.numbers.toasts.changed' : 'whatsapp.numbers.toasts.linked'));
    this.load();
  }

  protected async confirmUnlink(instance: WaInstance): Promise<void> {
    const userId = instance.assignedUserId;
    if (!userId || this.unlinkingId()) return;

    const ok = await this.dialog.confirm({
      title: this.t('whatsapp.numbers.unlinkDialog.title'),
      message: interpolate(this.t('whatsapp.numbers.unlinkDialog.message'), {
        name: instance.assignedUserName || '—',
        phone: this.phone(instance),
      }),
      confirmText: this.t('whatsapp.numbers.unlinkDialog.confirm'),
      cancelText: this.t('whatsapp.numbers.unlinkDialog.cancel'),
      type: 'warning',
    });
    if (!ok) return;

    this.unlinkingId.set(instance.id);
    this.api
      .assignNumber(userId, { instanceId: null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unlinkingId.set(null);
          this.session.applyInstance({ ...instance, assignedUserId: null, assignedUserName: null });
          this.toast.success(this.t('whatsapp.numbers.toasts.unlinked'));
          this.load();
        },
        error: (err) => {
          this.unlinkingId.set(null);
          this.toast.error(whatsappErrorText(err, (k) => this.t(k)));
        },
      });
  }

  protected phone(instance: WaInstance): string {
    return formatWhatsAppPhone(instance.phoneNumber) || this.t('whatsapp.numbers.noPhone');
  }

  protected status(instance: WaInstance): InstanceStatusMeta {
    return isChannelActive(instance)
      ? instanceStatusMeta(instance.status)
      : { tone: 'gray', labelKey: 'whatsapp.channels.removed' };
  }

  protected active(instance: WaInstance): boolean {
    return isChannelActive(instance);
  }

  protected pairable(instance: WaInstance): boolean {
    return canPair(instance);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
