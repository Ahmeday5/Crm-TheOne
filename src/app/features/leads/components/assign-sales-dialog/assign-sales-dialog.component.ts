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
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SalesPerson } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

@Component({
  selector: 'app-assign-sales-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-sales-dialog.component.html',
})
export class AssignSalesDialogComponent implements OnInit {
  /** Customer ID to assign. */
  @Input({ required: true }) customerId!: number;
  /** Customer name for display. */
  @Input() customerName = '';

  @Output() assigned = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  selectedSalesPersonId = '';

  ngOnInit(): void {
    this.loading.set(true);
    this.customers.salesTeam().subscribe({
      next: (team) => {
        this.salesTeam.set(team);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (!this.selectedSalesPersonId || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers
      .assign(this.customerId, { salesPersonId: this.selectedSalesPersonId })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(this.t('customers.messages.assigned'));
          this.assigned.emit();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message ?? null);
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
