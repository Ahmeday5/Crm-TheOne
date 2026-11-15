import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { ContractRenewal } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatContractDay } from '../../utils/contract-renewal.util';

/** Renewal history as a timeline, newest first: old period → new period, old price → new price, who, when, notes. */
@Component({
  selector: 'app-contract-renewals',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-renewals.component.html',
  styleUrl: './contract-renewals.component.scss',
})
export class ContractRenewalsComponent {
  private readonly language = inject(LanguageService);

  readonly renewals = input<ContractRenewal[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly retry = output<void>();

  protected day(value: string | null): string {
    return formatContractDay(value, this.language.lang()) ?? '—';
  }
}
