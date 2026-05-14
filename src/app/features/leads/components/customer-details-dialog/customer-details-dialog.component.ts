import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CustomerDetails } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';
import { resolveCustomerStatus } from '../../utils/customer-status.util';

@Component({
  selector: 'app-customer-details-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-details-dialog.component.html',
  styleUrl: './customer-details-dialog.component.scss',
})
export class CustomerDetailsDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Output() closed = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly language = inject(LanguageService);

  readonly customer = signal<CustomerDetails | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
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
