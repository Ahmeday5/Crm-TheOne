import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ContractDetail, ContractRenewal, RenewContractResponse } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractFormDialogComponent } from '../../components/contract-form-dialog/contract-form-dialog.component';
import { ContractRenewalsComponent } from '../../components/contract-renewals/contract-renewals.component';
import { RenewContractDialogComponent } from '../../components/renew-contract-dialog/renew-contract-dialog.component';
import { ContractsService } from '../../services/contracts.service';
import { ContractLifecycle, contractLifecycle, daysUntilEnd } from '../../utils/contract-lifecycle.util';
import { canRenew, formatContractDay } from '../../utils/contract-renewal.util';

const LIFECYCLE_TONE: Record<ContractLifecycle, string> = {
  active: 'success',
  expiring: 'warning',
  expired: 'danger',
  cancelled: 'secondary',
};

const DAY_MS = 86_400_000;

/**
 * `/contracts/:id` — one contract: status, period progress, customer,
 * renew action and renewal history. Contract notifications
 * (`ContractExpiringSoon` / `ContractExpired` / `ContractRenewed`) land here.
 */
@Component({
  selector: 'app-contract-details',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    TranslatePipe,
    MoneyPipe,
    CairoDatePipe,
    PageHeaderComponent,
    ContractRenewalsComponent,
    RenewContractDialogComponent,
    ContractFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-details.component.html',
  styleUrl: './contract-details.component.scss',
})
export class ContractDetailsComponent {
  private readonly service = inject(ContractsService);
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** `:id` route param — re-read on every navigation (notification → another contract). */
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly contractId = computed(() => {
    const n = Number(this.id());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  protected readonly contract = signal<ContractDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<{ notFound: boolean; message: string } | null>(null);

  protected readonly renewals = signal<ContractRenewal[]>([]);
  protected readonly renewalsLoading = signal(false);
  protected readonly renewalsFailed = signal(false);

  protected readonly renewOpen = signal(false);
  protected readonly editOpen = signal(false);
  /** Brief highlight after a successful renewal. */
  protected readonly justRenewed = signal(false);

  protected readonly lifecycle = computed(() => {
    const c = this.contract();
    return c ? contractLifecycle(c) : null;
  });
  protected readonly tone = computed(() => LIFECYCLE_TONE[this.lifecycle() ?? 'active']);
  protected readonly renewable = computed(() => {
    const c = this.contract();
    return !!c && canRenew(c);
  });
  protected readonly daysLeft = computed(() => daysUntilEnd(this.contract()?.endDate));

  /** Share of the period already elapsed (0–100), null for open-ended contracts. */
  protected readonly elapsed = computed(() => {
    const c = this.contract();
    if (!c?.endDate) return null;
    const start = Date.parse(c.startDate);
    const end = Date.parse(c.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  });

  protected readonly totalDays = computed(() => {
    const c = this.contract();
    if (!c?.endDate) return null;
    const days = Math.round((Date.parse(c.endDate) - Date.parse(c.startDate)) / DAY_MS);
    return Number.isFinite(days) && days > 0 ? days : null;
  });

  protected readonly daysLeftLabel = computed(() => {
    const days = this.daysLeft();
    if (days === null) return this.t('sales.contractDetails.openEnded');
    if (days < 0) return interpolate(this.t('sales.contractDetails.endedAgo'), { n: Math.abs(days) });
    if (days === 0) return this.t('sales.contractDetails.endsToday');
    return interpolate(this.t('sales.contractDetails.daysLeft'), { n: days });
  });

  constructor() {
    effect(() => {
      const id = this.contractId();
      untracked(() => {
        if (id) {
          this.load(id);
          this.loadRenewals(id);
        } else {
          this.loading.set(false);
          this.error.set({ notFound: true, message: this.t('sales.contractDetails.notFound') });
        }
      });
    });
  }

  protected load(id = this.contractId(), force = false): void {
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.service.getById(id, force).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (c) => {
        this.contract.set(c);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        const notFound = err?.status === 404;
        this.error.set({
          notFound,
          message: notFound ? this.t('sales.contractDetails.notFound') : err?.message?.trim() || this.t('sales.contractDetails.loadFailed'),
        });
      },
    });
  }

  protected loadRenewals(id = this.contractId(), force = false): void {
    if (!id) return;
    this.renewalsLoading.set(true);
    this.renewalsFailed.set(false);
    this.service.renewals(id, force).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.renewals.set(rows);
        this.renewalsLoading.set(false);
      },
      error: () => {
        this.renewalsLoading.set(false);
        this.renewalsFailed.set(true);
      },
    });
  }

  protected onRenewed(res: RenewContractResponse): void {
    this.renewOpen.set(false);
    if (res?.contract) this.contract.set(res.contract);
    if (res?.renewal) this.renewals.update((list) => [res.renewal, ...list.filter((r) => r.id !== res.renewal.id)]);
    // The response is authoritative, but refetch so every derived field (status name…) is fresh.
    this.load(this.contractId(), true);
    this.loadRenewals(this.contractId(), true);
    this.justRenewed.set(true);
    setTimeout(() => this.justRenewed.set(false), 2400);
  }

  protected onEdited(): void {
    this.editOpen.set(false);
    this.load(this.contractId(), true);
  }

  protected openDocument(): void {
    const id = this.contractId();
    if (id) this.router.navigate(['/sale-contract', id]);
  }

  protected day(value: string | null | undefined): string {
    return formatContractDay(value, this.language.lang()) ?? this.t('sales.renewal.openEnded');
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
