import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookLookupsService } from '../../data/playbook-lookups.service';
import { Competitor } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { playbookErrorMessage } from '../../utils/playbook-errors.util';
import { textRules } from '../../utils/playbook-validators.util';

/**
 * "A customer mentioned this competitor" — Admin / Sales / Support.
 * Picking a customer who's already linked just updates the note.
 */
@Component({
  selector: 'app-pb-mention-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent, SearchableSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [open]="true"
      [title]="'salesPlaybook.mentions.dialogTitle' | translate: { name: competitor().name }"
      icon="fa-solid fa-user-plus"
      iconTone="info"
      size="md"
      [closeOnBackdrop]="!submitting()"
      [closeOnEsc]="!submitting()"
      (closed)="close()">
      <form class="pf" [formGroup]="form" (ngSubmit)="submit()" novalidate id="pb-mention-form">
        <div class="pf-grid">
          <div class="pf-field pf-span">
            <label class="form-label fw-600" for="pf-m-customer">{{ 'salesPlaybook.mentions.customer' | translate }}</label>
            <app-searchable-select
              id="pf-m-customer"
              formControlName="customerId"
              [fetchFn]="customersFetch"
              labelKey="fullName"
              valueKey="id"
              subLabelKey="campanyName"
              [placeholder]="'salesPlaybook.mentions.customerPh' | translate" />
            <app-form-error [control]="form.controls.customerId" [label]="'salesPlaybook.mentions.customer' | translate" />
            @if (alreadyLinked()) {
              <small class="pf-hint"><i class="fa-solid fa-circle-info me-1"></i>{{ 'salesPlaybook.mentions.alreadyLinked' | translate }}</small>
            }
          </div>

          <div class="pf-field pf-span">
            <label class="form-label fw-600" for="pf-m-note">
              {{ 'salesPlaybook.mentions.note' | translate }}
              <span class="pf-optional">{{ 'salesPlaybook.form.optional' | translate }}</span>
            </label>
            <textarea id="pf-m-note" class="form-control" rows="3" formControlName="note" dir="auto"
                      [maxlength]="limits.note"
                      [placeholder]="'salesPlaybook.mentions.notePh' | translate"></textarea>
          </div>
        </div>

        @if (serverError()) {
          <div class="alert alert-danger d-flex gap-2 align-items-start mt-3 mb-0" role="alert">
            <i class="fa-solid fa-circle-exclamation mt-1"></i><span>{{ serverError() }}</span>
          </div>
        }
      </form>

      <div modal-footer class="btn-row justify-content-end w-100">
        <button type="button" class="btn btn-light" [disabled]="submitting()" (click)="close()">
          {{ 'salesPlaybook.form.cancel' | translate }}
        </button>
        <button type="submit" form="pb-mention-form" class="btn btn-primary" [disabled]="submitting()">
          @if (submitting()) {
            <span class="spinner-border spinner-border-sm me-1"></span>{{ 'salesPlaybook.form.saving' | translate }}
          } @else {
            <i class="fa-solid fa-link me-1"></i>{{ 'salesPlaybook.mentions.save' | translate }}
          }
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: '../playbook-form.scss',
})
export class MentionFormDialogComponent {
  readonly competitor = input.required<Competitor>();
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly lookups = inject(PlaybookLookupsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly limits = { note: 1000 };
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null, Validators.required),
    note: this.fb.nonNullable.control('', textRules(this.limits.note, false)),
  });

  private readonly selectedId = signal<number | null>(null);
  readonly alreadyLinked = computed(() => {
    const id = this.selectedId();
    return id != null && this.competitor().mentions.some((m) => m.customerId === id);
  });

  /** The customers dropdown is scoped by the backend (a rep sees their own customers). */
  readonly customersFetch = (): Observable<Record<string, unknown>[]> =>
    this.lookups.customers().pipe(map((rows) => rows as unknown as Record<string, unknown>[]));

  constructor() {
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const n = id == null ? null : Number(id);
      this.selectedId.set(n);
      const existing = this.competitor().mentions.find((m) => m.customerId === n);
      if (existing && !this.form.controls.note.dirty) this.form.controls.note.setValue(existing.note ?? '');
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    const customerId = Number(this.form.controls.customerId.value);
    if (this.form.invalid || !customerId || this.submitting()) return;

    this.submitting.set(true);
    this.serverError.set(null);
    this.store
      .addMention(this.competitor().id, { customerId, note: this.form.controls.note.value.trim() })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(this.t('salesPlaybook.mentions.saved'));
          this.closed.emit();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.serverError.set(playbookErrorMessage(err, this.t.bind(this)));
        },
      });
  }

  close(): void {
    if (!this.submitting()) this.closed.emit();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
