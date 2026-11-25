import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { CustomerListItem, CustomerResponse } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AddLeadComponent, AddLeadPrefill } from '../../../leads/pages/add-lead/add-lead.component';
import { CustomersService } from '../../../leads/services/customers.service';
import { WaChat } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';

/** `add` = create a new customer from the chat · `link` = attach the chat to an existing one. */
export type WaAddCustomerMode = 'add' | 'link';

type Step = 'checking' | 'existing' | 'form' | 'link';

/** Same number whatever the format: compare the last 10 digits (`+20 112…` = `0112…`). */
function phoneKey(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D+/g, '').slice(-10);
}

/**
 * WhatsApp chats carry digits only (`201124612772`). Egyptian numbers become
 * the local form the team types (`01124612772`); anything else gets `+`.
 */
export function chatPhoneForForm(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
  return `+${digits}`;
}

/**
 * "إضافة كعميل" / "ربط بعميل موجود" from a WhatsApp, Messenger or Instagram
 * chat that has no CRM customer yet.
 *
 * Add: if the chat has a phone, look it up first, because a customer with that
 * number may already exist (added after the chat started). Otherwise the
 * regular add-customer form opens pre-filled with the contact name (+ phone on
 * WhatsApp); every required field stays required. After saving, the chat is
 * linked to the new customer.
 *
 * Link: pick an existing customer. This is the only way to match Messenger /
 * Instagram chats, which have no phone.
 */
@Component({
  selector: 'app-wa-add-customer-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, SearchableSelectComponent, AddLeadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-add-customer-dialog.component.html',
})
export class WaAddCustomerDialogComponent implements OnInit {
  private readonly api = inject(WhatsAppApiService);
  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly chat = input.required<WaChat>();
  readonly mode = input<WaAddCustomerMode>('add');

  /** The chat after linking (server copy, or a local patch). */
  readonly linked = output<WaChat>();
  readonly closed = output<void>();

  protected readonly step = signal<Step>('checking');
  protected readonly matches = signal<CustomerListItem[]>([]);
  protected readonly linking = signal(false);
  protected readonly customerControl = new FormControl<number | null>(null);

  protected readonly prefill = computed<AddLeadPrefill>(() => ({
    fullName: this.chat().contactName,
    phone: chatPhoneForForm(this.chat().phone),
  }));

  /** Messenger / Instagram: no phone to pre-fill, so the employee asks for it. */
  protected readonly noPhone = computed(() => !this.chat().phone);

  protected readonly title = computed(() =>
    this.step() === 'link' ? 'whatsapp.addCustomer.linkTitle' : 'whatsapp.addCustomer.title',
  );

  protected readonly fetchCustomers = (): Observable<Record<string, unknown>[]> =>
    this.api.customersDropdown().pipe(map((rows) => rows as unknown as Record<string, unknown>[]));

  ngOnInit(): void {
    if (this.mode() === 'link') {
      this.step.set('link');
      return;
    }
    const key = phoneKey(this.chat().phone);
    if (key.length < 7) {
      this.step.set('form');
      return;
    }
    this.customers.search(key).subscribe({
      next: (rows) => {
        const found = (rows ?? []).filter((r) => phoneKey(r.phone) === key);
        this.matches.set(found);
        this.step.set(found.length ? 'existing' : 'form');
      },
      // The lookup is only a hint: the server's duplicate-phone 400 still guards the save.
      error: () => this.step.set('form'),
    });
  }

  protected continueToForm(): void {
    this.step.set('form');
  }

  protected onCreated(customer: CustomerResponse): void {
    this.link(customer.id, customer.fullName, true);
  }

  protected linkSelected(): void {
    const id = this.customerControl.value;
    if (!id) return;
    this.link(id, null, false);
  }

  protected linkTo(customer: CustomerListItem): void {
    this.link(customer.id, customer.fullName, false);
  }

  private link(customerId: number, customerName: string | null, justCreated: boolean): void {
    if (this.linking()) return;
    this.linking.set(true);
    const chat = this.chat();
    this.api.linkCustomer(chat.id, customerId).subscribe({
      next: (updated) => {
        this.linking.set(false);
        this.toast.success(this.t('whatsapp.addCustomer.linked'));
        this.linked.emit(updated ?? { ...chat, customerId, customerName: customerName ?? chat.customerName });
        this.closed.emit();
      },
      error: () => {
        this.linking.set(false);
        if (justCreated) {
          // The customer exists now; only the chat link failed (e.g. endpoint not live yet).
          this.toast.warning(this.t('whatsapp.addCustomer.createdNotLinked'));
          this.closed.emit();
        } else {
          this.toast.error(this.t('whatsapp.addCustomer.linkFailed'));
        }
      },
    });
  }

  protected existingLabel(c: CustomerListItem): string {
    return interpolate(this.t('whatsapp.addCustomer.existing'), { name: c.fullName });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
