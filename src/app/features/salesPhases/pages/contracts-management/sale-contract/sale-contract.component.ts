import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../../core/i18n';
import { LanguageService } from '../../../../../core/services/language.service';
import { LoadErrorComponent } from '../../../../../shared/components/load-error/load-error.component';
import { ContractDetail } from '../../../../../shared/models';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { ContractsService } from '../../../services/contracts.service';

const AR_WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

/**
 * Printable "عقد بيع حق استغلال واستخدام" document for a single contract.
 *
 * Reproduces the official The One System sale-contract template (the PDF the
 * client supplied): branded bilingual header, the two-party preamble, the
 * twelve numbered clauses across four A4 pages, and the signature block.
 * Everything outside `.contract-sheet` is hidden by the print stylesheet so
 * `window.print()` yields the document alone.
 *
 * Only the second party's identity comes from the API
 * (`GET /Contracts/GetContractById/{id}`): the contract date, the company
 * name, the signatory name and the phone — plus the agreed price injected
 * into clause 6. "بصفته" and "العنوان" are intentionally left blank to be
 * filled in by hand on the printed copy. The rest is the company's standing
 * legal boilerplate and is intentionally hard-coded Arabic.
 */
@Component({
  selector: 'app-sale-contract',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-contract.component.html',
  styleUrl: './sale-contract.component.scss',
})
export class SaleContractComponent implements OnInit {
  private readonly service = inject(ContractsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  private contractId: number | null = null;

  readonly contract = signal<ContractDetail | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Contract date — the contract's `createdAt`, today's date as fallback. */
  readonly issueDate = computed(() => {
    const created = this.contract()?.createdAt;
    const d = created ? new Date(created) : new Date();
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const dd = String(safe.getDate()).padStart(2, '0');
    const mm = String(safe.getMonth() + 1).padStart(2, '0');
    return {
      weekday: AR_WEEKDAYS[safe.getDay()],
      date: `${dd} / ${mm} / ${safe.getFullYear()}`,
    };
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.contractId = idParam ? Number(idParam) : null;
    this.load();
  }

  load(): void {
    if (this.contractId === null) {
      this.loadError.set(this.t('sales.contractsMgmt.contract.loadFailed'));
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(this.contractId).subscribe({
      next: (contract) => {
        this.contract.set(contract);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('sales.contractsMgmt.contract.loadFailed'));
      },
    });
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/contracts-management']);
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) return '';
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
