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
import { SupportPerson } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../services/customers.service';

@Component({
  selector: 'app-assign-support-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-support-dialog.component.html',
})
export class AssignSupportDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';

  @Output() assigned = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly supportTeam = signal<SupportPerson[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedId = signal('');

  readonly canSubmit = computed(() => !!this.selectedId() && !this.submitting());

  ngOnInit(): void {
    this.loading.set(true);
    this.customers.supportTeam().subscribe({
      next: (team) => {
        this.supportTeam.set(team);
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

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.assignSupport(this.customerId, { supportPersonId: id }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.supportModal.success'));
        this.assigned.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.supportModal.failed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
