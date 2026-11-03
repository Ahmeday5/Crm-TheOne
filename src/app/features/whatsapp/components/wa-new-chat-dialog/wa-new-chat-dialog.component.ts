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
import { Observable, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaMessage, WaSendTarget } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  WHATSAPP_MAX_TEXT_LENGTH,
  formatWhatsAppPhone,
  isChannelActive,
  isTransientError,
  newClientMessageId,
  normalizeRecipientPhone,
  whatsappErrorText,
} from '../../utils/whatsapp.util';

type RecipientMode = 'customer' | 'phone';

/**
 * Start a conversation with anyone: any CRM customer (whoever it is assigned
 * to) or any typed phone, plus the first message. If the phone belongs to a
 * customer, the backend links the chat to them by itself. Nothing is created until that message is sent — then the chat
 * exists and the host opens `message.chatId`.
 *
 * Admins also pick the number to send from (defaults to the channel being
 * viewed); employees always send from their own number, so they see no picker.
 * A network failure keeps the same `clientMessageId` for the next attempt so
 * the message can never go out twice.
 */
@Component({
  selector: 'app-wa-new-chat-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ModalComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-new-chat-dialog.component.html',
})
export class WaNewChatDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(WhatsAppSessionStore);

  /** Admin: the channel being viewed — the default sending number. */
  readonly defaultInstanceId = input<string | null>(null);

  readonly closed = output<void>();
  /** The first message was stored — open its chat. */
  readonly started = output<WaMessage>();

  protected readonly mode = signal<RecipientMode>('customer');
  protected readonly customerId = signal<number | null>(null);
  protected readonly phone = signal('+20');
  protected readonly text = signal('');
  protected readonly instanceId = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly maxLength = WHATSAPP_MAX_TEXT_LENGTH;

  /** Only numbers that can send right now. */
  protected readonly channelOptions = computed(() =>
    this.session
      .channels()
      .filter((c) => c.canSend && isChannelActive(c))
      .map((c) => ({
        id: c.id,
        label: formatWhatsAppPhone(c.phoneNumber) || c.name || c.id,
        sub: c.assignedUserName ?? this.t(c.isDefault ? 'whatsapp.numbers.companyBadge' : 'whatsapp.numbers.unassigned'),
      })),
  );

  protected readonly normalizedPhone = computed(() => normalizeRecipientPhone(this.phone()));
  protected readonly phoneInvalid = computed(
    () => this.mode() === 'phone' && this.touched() && !this.normalizedPhone(),
  );

  protected readonly canSend = computed(() => {
    if (this.sending() || !this.text().trim()) return false;
    if (this.session.isAdmin() && !this.instanceId()) return false;
    return this.mode() === 'customer' ? !!this.customerId() : !!this.normalizedPhone();
  });

  /** Kept across a network failure so a retry can't send twice. */
  private clientMessageId = newClientMessageId();

  protected readonly fetchCustomers = (): Observable<Record<string, unknown>[]> =>
    this.api.customersDropdown().pipe(map((rows) => rows as unknown as Record<string, unknown>[]));

  ngOnInit(): void {
    if (!this.session.isAdmin()) return;
    const options = this.channelOptions();
    const preferred = this.defaultInstanceId();
    const fallback =
      options.find((o) => o.id === preferred) ??
      options.find((o) => this.session.channel(o.id)?.isDefault) ??
      options[0];
    this.instanceId.set(fallback?.id ?? null);
  }

  protected setMode(mode: RecipientMode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  protected onCustomer(id: number | null): void {
    this.customerId.set(id);
    this.changed();
  }

  protected onPhone(value: string): void {
    this.phone.set(value);
    this.changed();
  }

  protected onInstance(id: string | null): void {
    this.instanceId.set(id);
    this.changed();
  }

  protected onText(value: string): void {
    this.text.set(value);
    this.changed();
  }

  protected submit(): void {
    this.touched.set(true);
    if (!this.canSend()) return;

    const target: WaSendTarget =
      this.mode() === 'customer' ? { customerId: this.customerId()! } : { phone: this.normalizedPhone()! };

    this.sending.set(true);
    this.error.set(null);
    this.api
      .sendText({
        target,
        text: this.text().trim(),
        clientMessageId: this.clientMessageId,
        instanceId: this.session.isAdmin() ? this.instanceId() ?? undefined : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          this.sending.set(false);
          this.started.emit(message);
        },
        error: (err) => {
          this.sending.set(false);
          if (!isTransientError(err)) this.clientMessageId = newClientMessageId();
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.sendFailed'));
        },
      });
  }

  /** A changed message or recipient is a different message → a new idempotency key. */
  private changed(): void {
    this.error.set(null);
    this.clientMessageId = newClientMessageId();
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
