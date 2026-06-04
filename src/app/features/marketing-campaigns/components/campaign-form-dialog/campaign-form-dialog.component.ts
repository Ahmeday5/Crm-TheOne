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
import { MultiSelectComponent } from '../../../../shared/components/multi-select/multi-select.component';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_CODE,
  Campaign,
  CampaignStatus,
  ChannelSource,
  CountryOption,
  CreateCampaignRequest,
  GENDER_NAME_TO_CODE,
  GenderCode,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CampaignsService } from '../../services/campaigns.service';
import { ChannelSourcesService } from '../../services/channel-sources.service';
import { ChannelSourceDialogComponent } from '../channel-source-dialog/channel-source-dialog.component';

@Component({
  selector: 'app-campaign-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    ChannelSourceDialogComponent,
    MultiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-form-dialog.component.html',
  styleUrl: './campaign-form-dialog.component.scss',
})
export class CampaignFormDialogComponent implements OnInit {
  /** When the host already has the channel-source list (e.g. for filters)
   * it can pass them in to skip a network round-trip. */
  @Input() initialSources: ChannelSource[] | null = null;

  /**
   * When provided, the dialog switches to edit mode: form is pre-filled,
   * the submit button hits `update()` instead of `add()`, and the title
   * + button label change accordingly.
   */
  @Input() campaign: Campaign | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  /** True when an existing campaign is being edited. */
  get isEditMode(): boolean {
    return this.campaign != null;
  }

  private readonly fb = inject(FormBuilder);
  private readonly campaigns = inject(CampaignsService);
  private readonly sources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly Gender = GenderCode;
  readonly statuses: ReadonlyArray<CampaignStatus> = CAMPAIGN_STATUSES;

  readonly channelSources = signal<ChannelSource[]>([]);
  readonly countries = signal<CountryOption[]>([]);
  readonly loadingSources = signal(false);
  readonly loadingCountries = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly channelSourceDialogOpen = signal(false);
  readonly startDateSig = signal<string | null>(null);
  readonly endDateSig = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      channelSourceId: this.fb.control<number | null>(
        null,
        Validators.required,
      ),
      status: [CAMPAIGN_STATUS_CODE.Active as number, Validators.required],
      budget: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1),
      ]),
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      minAge: this.fb.control<number | null>(null, [
        Validators.min(0),
        Validators.max(120),
      ]),
      maxAge: this.fb.control<number | null>(null, [
        Validators.min(0),
        Validators.max(120),
      ]),
      gender: [GenderCode.All as number, Validators.required],
      countries: this.fb.nonNullable.control<number[]>([]),
    },
    { validators: [this.dateRangeValidator, this.ageRangeValidator] },
  );

  /** Live derived duration in days (read-only display). */
  readonly durationDays = computed(() => {
    const start = this.startDateSig();
    const end = this.endDateSig();

    if (!start || !end) return 0;

    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    const diff = endDate.getTime() - startDate.getTime();

    return Math.max(0, Math.ceil(diff / 86_400_000));
  });

  ngOnInit(): void {
    if (this.initialSources && this.initialSources.length) {
      this.channelSources.set(this.initialSources);
    } else {
      this.loadSources();
    }
    this.loadCountries();

    this.form.controls.startDate.valueChanges.subscribe((v) => {
      this.startDateSig.set(v);
    });

    this.form.controls.endDate.valueChanges.subscribe((v) => {
      this.endDateSig.set(v);
    });

    if (this.campaign) this.patchFromCampaign(this.campaign);
  }

  /** Mirrors backend → form. Date inputs need `yyyy-MM-dd` slices. */
  private patchFromCampaign(c: Campaign): void {
    // Read the *local* calendar components, never `toISOString()`. The backend
    // echoes the date without a timezone marker, so `toISOString()` would shift
    // it back to the previous UTC day (e.g. Jun 3 → Jun 2) and the edit form
    // would disagree with the details view, which formats in local time.
    const toDateInput = (iso: string | null | undefined): string => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    this.form.patchValue({
      name: c.name ?? '',
      description: c.description ?? '',
      channelSourceId: c.channelSourceId ?? null,
      status: CAMPAIGN_STATUS_CODE[c.status] ?? CAMPAIGN_STATUS_CODE.Active,
      budget: c.budget ?? null,
      startDate: toDateInput(c.startDate),
      endDate: toDateInput(c.endDate),
      minAge: c.minAge ?? null,
      maxAge: c.maxAge ?? null,
      gender: GENDER_NAME_TO_CODE[c.gender] ?? GenderCode.All,
      countries: Array.isArray(c.countries)
        ? c.countries.map((country) => country.countryId)
        : [],
    });
  }

  loadSources(): void {
    this.loadingSources.set(true);
    this.sources.list().subscribe({
      next: (rows) => {
        this.channelSources.set(rows ?? []);
        this.loadingSources.set(false);
      },
      error: () => this.loadingSources.set(false),
    });
  }

  loadCountries(): void {
    this.loadingCountries.set(true);
    this.campaigns.countriesDropdown().subscribe({
      next: (rows) => {
        this.countries.set(rows ?? []);
        this.loadingCountries.set(false);
      },
      error: () => this.loadingCountries.set(false),
    });
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: CreateCampaignRequest = {
      name: (v.name ?? '').trim(),
      description: (v.description ?? '').trim(),
      channelSourceId: Number(v.channelSourceId),
      budget: Number(v.budget) || 0,
      durationDays: this.durationDays() || 1,
      startDate: this.toIsoDateTime(v.startDate),
      endDate: this.toIsoDateTime(v.endDate),
      gender: Number(v.gender) as GenderCode,
      minAge: Number(v.minAge) || 0,
      maxAge: Number(v.maxAge) || 0,
      countries: (v.countries ?? []).map((id) => Number(id)).filter((n) => Number.isFinite(n)),
      status: Number(v.status) || CAMPAIGN_STATUS_CODE.Active,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ = this.isEditMode
      ? this.campaigns.update(this.campaign!.id, payload)
      : this.campaigns.add(payload);
    const successKey = this.isEditMode
      ? 'campaigns.messages.updated'
      : 'campaigns.messages.created';
    const emitter = this.isEditMode ? this.updated : this.created;

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(successKey));
        emitter.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  // ─────────── channel-source side dialog ───────────

  openChannelSourceDialog(): void {
    this.channelSourceDialogOpen.set(true);
  }

  closeChannelSourceDialog(): void {
    this.channelSourceDialogOpen.set(false);
  }

  onChannelSourceCreated(source: ChannelSource): void {
    this.channelSources.update((list) => [...list, source]);
    this.form.controls.channelSourceId.setValue(source.id);
    this.closeChannelSourceDialog();
  }

  // ─────────── helpers ───────────

  /** i18n label resolver shared with the form-error binding. */
  label(key: string): string {
    return this.t(key);
  }

  isInvalid(ctrl: AbstractControl): boolean {
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  /**
   * `yyyy-MM-dd` → ISO at **UTC** midnight.
   *
   * Appending `Z` is deliberate: `new Date('2026-06-02T00:00:00')` (no zone)
   * is parsed as *local* time, so in a UTC+2/+3 region `.toISOString()` rolls
   * it back to the previous day before sending. Pinning to UTC midnight keeps
   * the day the user actually picked.
   */
  private toIsoDateTime(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00Z`).toISOString();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }

  // ─────────── form-level validators ───────────

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (!start || !end) return null;
    return new Date(end) > new Date(start) ? null : { endBeforeStart: true };
  }

  private ageRangeValidator(group: AbstractControl): ValidationErrors | null {
    const min = group.get('minAge')?.value;
    const max = group.get('maxAge')?.value;
    if (min == null || max == null) return null;
    return Number(max) >= Number(min) ? null : { ageRangeInvalid: true };
  }
}
