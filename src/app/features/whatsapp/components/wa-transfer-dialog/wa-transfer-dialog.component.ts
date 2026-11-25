import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { AssignSupportResponse, SalesPerson } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssignSupportDialogComponent } from '../../../leads/components/assign-support-dialog/assign-support-dialog.component';
import { CustomersService } from '../../../leads/services/customers.service';
import { INBOX_TOOLS_GATEWAY } from '../../data/inbox-tools.gateway';
import { WaChat } from '../../models/whatsapp.models';
import { chatDisplayName } from '../../utils/whatsapp.util';

type TransferTab = 'sales' | 'support';

/**
 * «تحويل لزميل» (§6) — Admin / Sales, linked chats only.
 *
 * - مندوب مبيعات: pick a sales rep (+ optional message) →
 *   `POST WhatsApp/chats/{id}/transfer` (reassigns the customer, notifies the
 *   rep, adds a system note, gives the rep access to the chat).
 * - الدعم الفني: the existing "transfer to support" dialog
 *   (`POST Customers/{id}/AssignToSupportPerson`, books an appointment).
 */
@Component({
  selector: 'app-wa-transfer-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, UserAvatarComponent, AssignSupportDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-transfer-dialog.component.html',
  styleUrl: './wa-transfer-dialog.component.scss',
})
export class WaTransferDialogComponent implements OnInit {
  private readonly tools = inject(INBOX_TOOLS_GATEWAY);
  private readonly customers = inject(CustomersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chat = input.required<WaChat>();
  readonly transferred = output<WaChat>();
  readonly closed = output<void>();

  protected readonly tab = signal<TransferTab>('sales');
  protected readonly reps = signal<SalesPerson[]>([]);
  protected readonly loadingReps = signal(true);
  protected readonly repsError = signal(false);
  protected readonly currentRepId = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly message = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The support hand-off dialog replaces this one while open. */
  protected readonly supportOpen = signal(false);

  protected readonly customerName = computed(() => chatDisplayName(this.chat()) ?? '');
  protected readonly canSubmit = computed(() => !!this.selectedId() && !this.saving());

  ngOnInit(): void {
    const me = this.auth.currentUser()?.userId;
    this.customers
      .salesTeam()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.loadingReps.set(false);
          const list = (Array.isArray(rows) ? rows : [])
            .filter((r) => !!r?.userId && r.userId !== me)
            .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ar'));
          this.reps.set(list);
        },
        error: () => {
          this.loadingReps.set(false);
          this.repsError.set(true);
        },
      });

    // Marks the customer's current rep — nice to have, silent on failure.
    const customerId = this.chat().customerId;
    if (customerId) {
      this.customers
        .getById(customerId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (c) => this.currentRepId.set(c?.salesPersonId ?? null), error: () => undefined });
    }
  }

  protected submit(): void {
    const rep = this.reps().find((r) => r.userId === this.selectedId());
    if (!rep || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const message = this.message().trim();
    this.tools
      .transfer(this.chat(), { toUserId: rep.userId, ...(message ? { message } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chat) => {
          this.saving.set(false);
          this.toast.success(interpolate(this.t('inboxTools.transfer.done'), { name: rep.fullName }));
          this.transferred.emit(chat);
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          this.error.set(e?.message || this.t('inboxTools.failed'));
        },
      });
  }

  /** The server adds the «اتحوّل للدعم» system note itself (the request carries `chatId`). */
  protected onSupportAssigned(_res: AssignSupportResponse): void {
    this.toast.success(this.t('inboxTools.transfer.supportDone'));
    this.transferred.emit(this.chat());
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
