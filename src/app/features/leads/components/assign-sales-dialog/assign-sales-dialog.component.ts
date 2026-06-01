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
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SalesPerson } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

@Component({
  selector: 'app-assign-sales-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-sales-dialog.component.html',
})
export class AssignSalesDialogComponent implements OnInit {
  /** Customer ID to assign. */
  @Input({ required: true }) customerId!: number;
  /** Customer name for display. */
  @Input() customerName = '';
  /** Currently assigned sales-person id, if any. Drives change-mode + pre-selection. */
  @Input() currentSalesPersonId: string | null = null;
  /** Currently assigned sales-person display name (email/full name). */
  @Input() currentSalesPersonName: string | null = null;

  @Output() assigned = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Selected rep id — signal so `canSubmit` recomputes when ngModel writes. */
  readonly selectedId = signal('');

  /** True when there is already an assigned rep — switches all copy to "change". */
  readonly isChangeMode = computed(() => !!this.currentSalesPersonId);

  /** Disable submit if nothing selected, or selection is unchanged in change-mode. */
  readonly canSubmit = computed(() => {
    const id = this.selectedId();
    if (!id || this.submitting()) return false;
    if (this.isChangeMode() && id === this.currentSalesPersonId) return false;
    return true;
  });

  ngOnInit(): void {
    if (this.currentSalesPersonId) {
      this.selectedId.set(this.currentSalesPersonId);
    }

    this.loading.set(true);
    this.customers.salesTeam().subscribe({
      next: (team) => {
        this.salesTeam.set(team);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSelect(id: string): void {
    this.selectedId.set(id);
    this.errorMessage.set(null);
  }

  submit(): void {
    const id = this.selectedId();
    if (!id || this.submitting()) return;

    if (this.isChangeMode() && id === this.currentSalesPersonId) {
      this.errorMessage.set(this.t('customers.assignModal.sameRepError'));
      this.toast.warning(this.t('customers.assignModal.sameRepError'));
      return;
    }

    const wasReassign = this.isChangeMode();

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.assign(this.customerId, { salesPersonId: id }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          wasReassign
            ? this.t('customers.messages.reassigned')
            : this.t('customers.messages.assigned'),
        );
        this.assigned.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.messages.assignFailed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
