import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CustomerDetails } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaThreadComponent } from '../../../whatsapp/components/wa-thread/wa-thread.component';
import { ThreadSource } from '../../../whatsapp/state/whatsapp-thread.store';
import { canUseWhatsApp } from '../../../whatsapp/utils/whatsapp.util';
import { CustomersService } from '../../services/customers.service';
import { resolveCustomerStatus } from '../../utils/customer-status.util';

export type CustomerDetailsTab = 'details' | 'whatsapp';

@Component({
  selector: 'app-customer-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, LoadErrorComponent, WaThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-details-dialog.component.html',
  styleUrl: './customer-details-dialog.component.scss',
})
export class CustomerDetailsDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  /** Tab to open on — the customer lists' WhatsApp button opens straight on the chat. */
  @Input() initialTab: CustomerDetailsTab = 'details';
  @Output() closed = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly customer = signal<CustomerDetails | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  /** Only the roles that chat with customers get the WhatsApp tab. */
  readonly canChat = computed(() => canUseWhatsApp(this.auth.currentRole()));
  readonly tab = signal<CustomerDetailsTab>('details');
  readonly whatsappSource = signal<ThreadSource | null>(null);

  ngOnInit(): void {
    this.whatsappSource.set({ kind: 'customer', customerId: this.customerId });
    this.tab.set(this.initialTab === 'whatsapp' && this.canChat() ? 'whatsapp' : 'details');
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.customers.getById(this.customerId).subscribe({
      next: (data) => {
        this.customer.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('customers.messages.loadFailed'));
      },
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return this.t('customers.details.notAvailable');
    try {
      return new Date(dateStr).toLocaleDateString(
        this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
      );
    } catch {
      return dateStr;
    }
  }

  resolveStatus(statusName: string | null | undefined): string {
    if (!statusName || statusName === 'none') {
      return this.t('customers.table.unknownStatus');
    }
    return resolveCustomerStatus(statusName, this.language.lang(), statusName);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
