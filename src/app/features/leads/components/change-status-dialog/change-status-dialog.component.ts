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
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CustomerFollowUpResponse, CustomerStatus } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';
import { customerStatusKey, resolveCustomerStatus } from '../../utils/customer-status.util';

@Component({
  selector: 'app-change-status-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-status-dialog.component.html',
})
export class ChangeStatusDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';
  /** Current status name (e.g. "تفاوض"). Used only to highlight the row. */
  @Input() currentStatus: string | null = null;

  @Output() changed = new EventEmitter<CustomerFollowUpResponse>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly statuses = signal<CustomerStatus[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedId = signal<number | null>(null);

  readonly canSubmit = computed(() => {
    const id = this.selectedId();
    return id !== null && !this.submitting();
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.customers.statuses().subscribe({
      next: (items) => {
        this.statuses.set(items);
        // Pre-select the current status — `currentStatus` may arrive as an
        // English enum code (list response) while `items[*].name` is Arabic,
        // so we compare via the canonical key.
        const currentKey = customerStatusKey(this.currentStatus);
        if (currentKey) {
          const match = items.find((s) => customerStatusKey(s.name) === currentKey);
          if (match) this.selectedId.set(match.id);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSelect(id: number): void {
    this.selectedId.set(id);
    this.errorMessage.set(null);
  }

  submit(): void {
    const id = this.selectedId();
    if (id === null || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.changeStatus(this.customerId, { status: id }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.statusModal.success'));
        this.changed.emit(res);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.statusModal.failed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  /** Localized label for a status (handles both Arabic API names and English codes). */
  statusLabel(name: string | null | undefined): string {
    if (!name) return '';
    return resolveCustomerStatus(name, this.language.lang(), name);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
