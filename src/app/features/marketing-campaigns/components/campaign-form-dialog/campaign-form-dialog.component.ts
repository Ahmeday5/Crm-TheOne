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
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_CODE,
  CampaignStatus,
  ChannelSource,
  CreateCampaignRequest,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-form-dialog.component.html',
  styleUrl: './campaign-form-dialog.component.scss',
})
export class CampaignFormDialogComponent implements OnInit {
  /** When the host already has the channel-source list (e.g. for filters)
   * it can pass them in to skip a network round-trip. */
  @Input() initialSources: ChannelSource[] | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly campaigns = inject(CampaignsService);
  private readonly sources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly Gender = GenderCode;
  readonly statuses: ReadonlyArray<CampaignStatus> = CAMPAIGN_STATUSES;

  readonly channelSources = signal<ChannelSource[]>([]);
  readonly loadingSources = signal(false);
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
      countriesText: [''],
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

    // 👇 ده المهم
    this.form.controls.startDate.valueChanges.subscribe((v) => {
      this.startDateSig.set(v);
    });

    this.form.controls.endDate.valueChanges.subscribe((v) => {
      this.endDateSig.set(v);
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
      countries: this.parseCountries(v.countriesText ?? ''),
      status: Number(v.status) || CAMPAIGN_STATUS_CODE.Active,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.campaigns.add(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('campaigns.messages.created'));
        this.created.emit();
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

  private parseCountries(value: string): number[] {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
  }

  private toIsoDateTime(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00`).toISOString();
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
