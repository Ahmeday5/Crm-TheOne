import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  WritableSignal,
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
import {
  CommissionTier,
  CreateGoalRequest,
  Goal,
  GoalCommissionRates,
  GoalPeriod,
  GoalType,
  SalesPerson,
  UpdateGoalRequest,
} from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CommissionRangePipe } from '../../pipes/commission-range.pipe';
import { GoalsService } from '../../services/goals.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import {
  COMMISSION_RATE_FIELD,
  COMMISSION_TIERS,
  CommissionQuote,
  commissionPreviewPercents,
  hasCommissionRates,
  isValidCommissionRate,
  isValidCommissionThreshold,
  quoteCommission,
} from '../../utils/goal-commission.util';

interface CommissionPreviewRow extends CommissionQuote {
  collected: number;
}

function toLocalDatetimeValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-goal-form-dialog',
  standalone: true,
  imports: [
    UserAvatarComponent,
    CommonModule,
    FormsModule,
    TranslatePipe,
    MoneyPipe,
    PercentLabelPipe,
    CommissionRangePipe,
    ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goal-form-dialog.component.html',
  styleUrl: './goal-form-dialog.component.scss',
})
export class GoalFormDialogComponent implements OnInit {
  @Input() goal: Goal | null = null;
  @Output() saved = new EventEmitter<Goal>();
  @Output() cancel = new EventEmitter<void>();

  private readonly goalsService = inject(GoalsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly GOAL_TYPES: GoalType[] = ['Individual', 'Team'];
  readonly GOAL_PERIODS: GoalPeriod[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
  readonly COMMISSION_TIERS = COMMISSION_TIERS;

  readonly title = signal('');
  readonly description = signal('');
  readonly type = signal<GoalType>('Individual');
  readonly period = signal<GoalPeriod>('Monthly');
  readonly targetValue = signal<number | null>(null);
  readonly points = signal<number | null>(null);
  readonly financialReward = signal<number | null>(null);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly assignedToId = signal<string | null>(null);
  /** Optional whole 1–100 — achievement % that opens the `UpToTarget` bracket. */
  readonly commissionThreshold = signal<number | null>(null);
  /** Optional 0–100 rate per bracket, decimals allowed. */
  readonly commissionRates: Readonly<Record<CommissionTier, WritableSignal<number | null>>> = {
    BelowThreshold: signal<number | null>(null),
    UpToTarget: signal<number | null>(null),
    AboveTarget: signal<number | null>(null),
  };

  readonly salesPersons = signal<SalesPerson[]>([]);
  readonly loadingSales = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isEditMode = computed(() => this.goal !== null);
  readonly showAssignedTo = computed(() => this.type() === 'Individual');

  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      this.title().trim().length > 0 &&
      this.description().trim().length > 0 &&
      (this.targetValue() ?? 0) > 0 &&
      (this.points() ?? 0) > 0 &&
      (this.financialReward() ?? 0) >= 0 &&
      this.startDate().length > 0 &&
      this.endDate().length > 0 &&
      this.endDateValid() &&
      (!this.showAssignedTo() || !!this.assignedToId()) &&
      this.commissionValid(),
  );

  readonly thresholdValid = computed(() => isValidCommissionThreshold(this.commissionThreshold()));

  /** Rates as the API names them — feeds the payload and the preview. */
  readonly ratesPayload = computed<GoalCommissionRates>(() => {
    const payload = {} as GoalCommissionRates;
    for (const tier of COMMISSION_TIERS) {
      payload[COMMISSION_RATE_FIELD[tier]] = this.commissionRates[tier]();
    }
    return payload;
  });

  readonly commissionValid = computed(
    () =>
      this.thresholdValid() &&
      COMMISSION_TIERS.every((tier) => isValidCommissionRate(this.commissionRates[tier]())),
  );

  /** Threshold for range captions — ignored while it's mid-edit / invalid. */
  readonly displayThreshold = computed(() =>
    this.thresholdValid() ? this.commissionThreshold() : null,
  );

  /** Worked example on this goal's own target, one row per bracket boundary. */
  readonly commissionPreview = computed<CommissionPreviewRow[]>(() => {
    const target = this.targetValue() ?? 0;
    const rates = this.ratesPayload();
    if (target <= 0 || !this.commissionValid() || !hasCommissionRates(rates)) return [];

    const threshold = this.displayThreshold();
    return commissionPreviewPercents(threshold).map((pct) => {
      const collected = Math.round((target * pct) / 100);
      return { collected, ...quoteCommission(collected, target, threshold, rates) };
    });
  });

  readonly endDateValid = computed(() => {
    if (!this.startDate() || !this.endDate()) return true;
    const start = new Date(this.startDate()).getTime();
    const end = new Date(this.endDate()).getTime();
    return end - start >= 86_400_000;
  });

  ngOnInit(): void {
    if (this.goal) {
      this.title.set(this.goal.title);
      this.description.set(this.goal.description);
      this.type.set(this.goal.type);
      this.period.set(this.goal.period);
      this.targetValue.set(this.goal.targetValue);
      this.points.set(this.goal.points);
      this.financialReward.set(this.goal.financialReward);
      this.startDate.set(toLocalDatetimeValue(this.goal.startDate));
      this.endDate.set(toLocalDatetimeValue(this.goal.endDate));
      this.assignedToId.set(this.goal.assignedToId);
      this.commissionThreshold.set(this.goal.commissionThresholdPercent ?? null);
      for (const tier of COMMISSION_TIERS) {
        this.commissionRates[tier].set(this.goal[COMMISSION_RATE_FIELD[tier]] ?? null);
      }
    }
    this.loadSalesPersons();
  }

  private loadSalesPersons(): void {
    this.loadingSales.set(true);
    this.goalsService.getSalesPersons().subscribe({
      next: (persons) => {
        this.salesPersons.set(persons);
        this.loadingSales.set(false);
      },
      error: () => {
        this.loadingSales.set(false);
        this.toast.error(this.t('goals.messages.salesLoadFailed'));
      },
    });
  }

  onTypeChange(value: string): void {
    this.type.set(value as GoalType);
    if (value === 'Team') this.assignedToId.set(null);
    this.errorMessage.set(null);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    const isEdit = this.isEditMode();

    if (isEdit && this.goal) {
      const payload: UpdateGoalRequest = {
        title: this.title().trim(),
        description: this.description().trim(),
        period: this.period(),
        targetValue: this.targetValue()!,
        points: this.points()!,
        financialReward: this.financialReward()!,
        startDate: new Date(this.startDate()).toISOString(),
        endDate: new Date(this.endDate()).toISOString(),
        commissionThresholdPercent: this.commissionThreshold(),
        ...this.ratesPayload(),
      };
      this.goalsService.update(this.goal.id, payload).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('goals.messages.updateSuccess'));
          this.saved.emit(res);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const msg = err?.message?.trim() || this.t('goals.messages.updateFailed');
          this.errorMessage.set(msg);
          this.toast.error(msg);
        },
      });
    } else {
      const payload: CreateGoalRequest = {
        title: this.title().trim(),
        description: this.description().trim(),
        type: this.type(),
        period: this.period(),
        targetValue: this.targetValue()!,
        points: this.points()!,
        financialReward: this.financialReward()!,
        startDate: new Date(this.startDate()).toISOString(),
        endDate: new Date(this.endDate()).toISOString(),
        assignedToId: this.type() === 'Individual' ? this.assignedToId() : null,
        commissionThresholdPercent: this.commissionThreshold(),
        ...this.ratesPayload(),
      };
      this.goalsService.create(payload).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('goals.messages.createSuccess'));
          this.saved.emit(res);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const msg = err?.message?.trim() || this.t('goals.messages.createFailed');
          this.errorMessage.set(msg);
          this.toast.error(msg);
        },
      });
    }
  }

  /** `<input type="number">` yields `''`/`null` when cleared — normalise to `null`. */
  setOptionalNumber(target: WritableSignal<number | null>, raw: number | string | null): void {
    const v = raw === '' || raw === null ? null : Number(raw);
    target.set(v === null || Number.isNaN(v) ? null : v);
  }

  rateValid(tier: CommissionTier): boolean {
    return isValidCommissionRate(this.commissionRates[tier]());
  }

  periodIcon(period: GoalPeriod): string {
    const map: Record<GoalPeriod, string> = {
      Daily: 'fa-solid fa-sun',
      Weekly: 'fa-solid fa-calendar-week',
      Monthly: 'fa-solid fa-calendar-days',
      Yearly: 'fa-solid fa-calendar',
    };
    return map[period] ?? 'fa-solid fa-calendar';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
