import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../../shared/components/multi-select/multi-select.component';
import {
  CreateProjectRequest,
  CustomerDropdownItem,
  FormMode,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUSES,
  ProjectListItem,
  ProjectPriorityName,
  ProjectStatusName,
  UpdateProjectRequest,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../services/projects.service';

/** Requires the array control to hold at least one value. */
function nonEmptyArray(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown[];
  return Array.isArray(value) && value.length > 0 ? null : { required: true };
}

@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    MultiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-form-dialog.component.html',
})
export class ProjectFormDialogComponent implements OnInit, OnChanges {
  /** `'create'` or `'edit'`. */
  @Input({ required: true }) mode!: FormMode;
  /** The project to edit — required in edit mode. */
  @Input() project: ProjectListItem | null = null;

  /** Emitted after a successful save — host should reload + close. */
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly statuses = PROJECT_STATUSES;
  readonly priorities = PROJECT_PRIORITY_OPTIONS;

  readonly customers = signal<CustomerDropdownItem[]>([]);
  readonly loadingCustomers = signal(false);
  readonly engineerOptions = signal<MultiSelectOption<string>[]>([]);
  readonly loadingEngineers = signal(false);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    customerId: this.fb.control<number | null>(null, Validators.required),
    status: ['Planned' as ProjectStatusName, Validators.required],
    priority: ['Medium' as ProjectPriorityName, Validators.required],
    price: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    start: ['', Validators.required],
    end: ['', Validators.required],
    engineerIds: this.fb.nonNullable.control<string[]>([], nonEmptyArray),
  });

  readonly titleKey = computed(() =>
    this.mode === 'edit'
      ? 'projects.manage.form.editTitle'
      : 'projects.manage.form.addTitle',
  );

  ngOnInit(): void {
    this.loadCustomers();
    this.loadEngineers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'project' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.patchFromProject();
    }
  }

  // ─────────── lookups ───────────

  private loadCustomers(): void {
    this.loadingCustomers.set(true);
    this.service.customersDropdown().subscribe({
      next: (rows) => {
        this.customers.set(rows ?? []);
        this.loadingCustomers.set(false);
      },
      error: () => this.loadingCustomers.set(false),
    });
  }

  private loadEngineers(): void {
    this.loadingEngineers.set(true);
    this.service.developers().subscribe({
      next: (rows) => {
        this.engineerOptions.set(
          (rows ?? []).map((d) => ({ id: d.userId, name: d.fullName })),
        );
        this.loadingEngineers.set(false);
      },
      error: () => this.loadingEngineers.set(false),
    });
  }

  private patchFromProject(): void {
    const p = this.project;
    this.form.reset({
      title: p?.title ?? '',
      description: p?.description ?? '',
      customerId: p?.customerId ?? null,
      status: p?.status ?? 'Planned',
      priority: p?.priority ?? 'Medium',
      price: p?.price ?? null,
      start: this.toDateInput(p?.start),
      end: this.toDateInput(p?.end),
      engineerIds: p?.engineers?.map((e) => e.engineerId) ?? [],
    });
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: CreateProjectRequest & UpdateProjectRequest = {
      title: v.title.trim(),
      description: (v.description ?? '').trim(),
      customerId: Number(v.customerId),
      status: v.status,
      priority: v.priority,
      price: Number(v.price) || 0,
      start: this.toIso(v.start),
      end: this.toIso(v.end),
      engineerIds: v.engineerIds,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ =
      this.mode === 'edit' && this.project
        ? this.service.update(this.project.id, payload)
        : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          this.t(
            this.mode === 'edit'
              ? 'projects.manage.messages.updated'
              : 'projects.manage.messages.created',
          ),
        );
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  // ─────────── helpers ───────────

  /** ISO date-time → `yyyy-MM-dd` for the native date input. */
  private toDateInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  private toIso(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00`).toISOString();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
