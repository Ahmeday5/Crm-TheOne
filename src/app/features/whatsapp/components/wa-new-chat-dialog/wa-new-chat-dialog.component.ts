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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  channelLabel,
  isTransientError,
  newClientMessageId,
  normalizeInternationalPhone,
  whatsappErrorText,
} from '../../utils/whatsapp.util';
import { TemplateChoice, WaTemplateFormComponent } from '../wa-template-form/wa-template-form.component';

type RecipientMode = 'customer' | 'phone';

/**
 * "New conversation" (WhatsApp only): pick a CRM customer or type a phone in
 * international format, then an approved template with its variables →
 * `POST /send-template`. There is no free text here — WhatsApp only allows
 * a template to open a conversation, and the backend rejects anything else.
 *
 * Admins also pick the WhatsApp number to send from (defaults to the channel
 * being viewed); employees always send from their own number and never send
 * `instanceId`. A network failure keeps the same `clientMessageId` for the
 * next attempt so the template can never go out twice.
 */
@Component({
  selector: 'app-wa-new-chat-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, SearchableSelectComponent, WaTemplateFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-new-chat-dialog.component.html',
})
export class WaNewChatDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(WhatsAppSessionStore);

  /** Admin: the channel being viewed — the default sending number when it is a WhatsApp one. */
  readonly defaultInstanceId = input<string | null>(null);

  readonly closed = output<void>();
  /** The template was stored — open its chat. */
  readonly started = output<WaMessage>();

  protected readonly form = new FormGroup({
    mode: new FormControl<RecipientMode>('customer', { nonNullable: true }),
    customerId: new FormControl<number | null>(null),
    phone: new FormControl('+20', { nonNullable: true }),
    instanceId: new FormControl<string | null>(null),
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly mode = computed(() => this.value().mode);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly attempted = signal(false);
  protected readonly choice = signal<TemplateChoice | null>(null);

  /** WhatsApp numbers that can send right now. */
  protected readonly channelOptions = computed(() =>
    this.session
      .whatsAppChannels()
      .filter((c) => c.canSend)
      .map((c) => ({
        id: c.id,
        label: channelLabel(c),
        sub: c.assignedUserName ?? this.t(c.isDefault ? 'whatsapp.numbers.companyBadge' : 'whatsapp.numbers.unassigned'),
      })),
  );

  protected readonly normalizedPhone = computed(() => normalizeInternationalPhone(this.value().phone));
  protected readonly phoneInvalid = computed(
    () => this.mode() === 'phone' && (this.attempted() || this.form.controls.phone.touched) && !this.normalizedPhone(),
  );
  protected readonly customerMissing = computed(
    () => this.mode() === 'customer' && this.attempted() && !this.value().customerId,
  );
  /** Admins pick the number first; its templates load once it's chosen. */
  protected readonly templatesInstanceId = computed(() => (this.session.isAdmin() ? this.value().instanceId : null));
  protected readonly needsChannel = computed(() => this.session.isAdmin() && !this.value().instanceId);

  protected readonly target = computed<WaSendTarget | null>(() => {
    const v = this.value();
    if (v.mode === 'customer') return v.customerId ? { customerId: v.customerId } : null;
    const phone = this.normalizedPhone();
    return phone ? { phone } : null;
  });

  /** Kept across a network failure so a retry can't send twice. */
  private clientMessageId = newClientMessageId();

  protected readonly fetchCustomers = (): Observable<Record<string, unknown>[]> =>
    this.api.customersDropdown().pipe(map((rows) => rows as unknown as Record<string, unknown>[]));

  constructor() {
    // A different recipient / number is a different message → a new idempotency key.
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.changed());
  }

  ngOnInit(): void {
    if (!this.session.isAdmin()) return;
    const options = this.channelOptions();
    const preferred = this.defaultInstanceId();
    const fallback =
      options.find((o) => o.id === preferred) ??
      options.find((o) => this.session.channel(o.id)?.isDefault) ??
      options[0];
    this.form.controls.instanceId.setValue(fallback?.id ?? null);
  }

  protected setMode(mode: RecipientMode): void {
    this.form.controls.mode.setValue(mode);
  }

  protected onChoice(choice: TemplateChoice | null): void {
    this.choice.set(choice);
    this.changed();
  }

  protected submit(): void {
    this.attempted.set(true);
    this.form.markAllAsTouched();
    const target = this.target();
    const choice = this.choice();
    if (!target || !choice || this.needsChannel() || this.sending()) return;

    const instanceId = this.session.isAdmin() ? this.value().instanceId ?? undefined : undefined;
    this.sending.set(true);
    this.error.set(null);
    this.form.disable({ emitEvent: false });

    this.api
      .sendTemplate({
        target,
        clientMessageId: this.clientMessageId,
        instanceId,
        templateId: choice.template.id,
        template: choice.template.name,
        language: choice.template.language,
        parameters: choice.parameters,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          this.sending.set(false);
          this.started.emit(message);
        },
        error: (err: unknown) => {
          this.sending.set(false);
          this.form.enable({ emitEvent: false });
          if (!isTransientError(err)) this.clientMessageId = newClientMessageId();
          this.error.set(whatsappErrorText(err, (k) => this.t(k), 'whatsapp.errors.sendFailed'));
        },
      });
  }

  private changed(): void {
    this.error.set(null);
    this.clientMessageId = newClientMessageId();
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
