import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AssignOutcome,
  WaAssignNumberDialogComponent,
} from '../../components/wa-assign-number-dialog/wa-assign-number-dialog.component';
import { WhatsAppInstance } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import {
  InstanceStatusMeta,
  formatWhatsAppPhone,
  instanceStatusMeta,
  isNumberWorking,
  whatsappErrorText,
} from '../../utils/whatsapp.util';

/**
 * Settings → WhatsApp numbers (Admin). Numbers are paired with a phone on the
 * Wavex dashboard (QR, outside the CRM); here the admin decides which
 * employee sends from which number. Employees without a number send from
 * the company default.
 */
@Component({
  selector: 'app-whatsapp-numbers',
  standalone: true,
  imports: [
    TranslatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
    UserAvatarComponent,
    ResponsiveTableDirective,
    WaAssignNumberDialogComponent,
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

  protected readonly instances = signal<WhatsAppInstance[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** The number whose assign / change dialog is open. */
  protected readonly assigning = signal<WhatsAppInstance | null>(null);
  /** Instance id with an unlink in flight. */
  protected readonly unlinkingId = signal<string | null>(null);

  /** Company number first, then by phone. */
  protected readonly rows = computed(() =>
    [...this.instances()].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault) || (a.phoneNumber ?? '').localeCompare(b.phoneNumber ?? ''),
    ),
  );

  protected readonly kpis = computed(() => {
    const list = this.instances();
    const connected = list.filter((i) => isNumberWorking(i.status)).length;
    return {
      total: list.length,
      connected,
      attention: list.length - connected,
      assigned: list.filter((i) => !!i.assignedUserId).length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .instances()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.instances.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.loadError.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.numbers.loadFailed'));
        },
      });
  }

  protected openAssign(instance: WhatsAppInstance): void {
    this.assigning.set(instance);
  }

  protected onAssigned(outcome: AssignOutcome): void {
    this.assigning.set(null);
    this.toast.success(this.t(outcome === 'changed' ? 'whatsapp.numbers.toasts.changed' : 'whatsapp.numbers.toasts.linked'));
    this.load();
  }

  protected async confirmUnlink(instance: WhatsAppInstance): Promise<void> {
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
          this.toast.success(this.t('whatsapp.numbers.toasts.unlinked'));
          this.load();
        },
        error: (err) => {
          this.unlinkingId.set(null);
          this.toast.error(whatsappErrorText(err, (k) => this.t(k)));
        },
      });
  }

  protected phone(instance: WhatsAppInstance): string {
    return formatWhatsAppPhone(instance.phoneNumber) || this.t('whatsapp.numbers.noPhone');
  }

  protected status(instance: WhatsAppInstance): InstanceStatusMeta {
    return instanceStatusMeta(instance.status);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
